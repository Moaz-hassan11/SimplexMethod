// ================================================================
// PROBLEM FORM COMPONENT — problem-form.component.ts
// ================================================================
//
// This is the MAIN INPUT FORM where users define their LP problem.
//
// 🔑 KEY CONCEPT: Standalone Components
// ──────────────────────────────────────
// In OLD Angular, every component had to be part of a NgModule.
// In MODERN Angular (v15+), components are STANDALONE by default:
//   - No NgModule needed
//   - Each component declares its own imports
//   - Simpler, more self-contained
//
// 🔑 KEY CONCEPT: Reactive Forms
// ───────────────────────────────
// Angular has TWO form approaches:
//   1. Template-driven forms — simpler, uses [(ngModel)]
//   2. Reactive forms — more powerful, defined in TypeScript
//
// We use REACTIVE FORMS because:
//   - We need DYNAMIC rows (add/remove constraints)
//   - We need programmatic control over form structure
//   - Better for complex forms with validation
//
// Key Classes:
//   FormGroup   — a group of controls (like a <form>)
//   FormControl — a single input field
//   FormArray   — a dynamic array of controls (add/remove rows!)
//   FormBuilder — helper to create forms with less boilerplate
//
// 🔑 KEY CONCEPT: Output / EventEmitter vs Direct Service Call
// ─────────────────────────────────────────────────────────────
// We could emit the form data to the parent via @Output().
// Instead, we inject SimplexService directly — simpler for this app.
// ================================================================

import { Component, signal, computed, inject, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,    // Enables [formGroup], formControlName, etc.
  FormBuilder,            // Helper to build forms
  FormGroup,
  FormArray,
  Validators              // Built-in validation rules
} from '@angular/forms';
import { SimplexService } from '../../services/simplex.service';
import { LPRequest, Constraint } from '../../models/lp.models';

@Component({
  // ── selector ──────────────────────────────────────────────────
  // This is the HTML tag name: <app-problem-form></app-problem-form>
  // The parent component uses this to embed this component.
  selector: 'app-problem-form',

  // ── imports ───────────────────────────────────────────────────
  // Standalone components list their dependencies here.
  // ReactiveFormsModule gives us [formGroup], formControlName, etc.
  imports: [ReactiveFormsModule],

  // ── templateUrl / styleUrl ────────────────────────────────────
  // Points to the HTML and CSS files for this component.
  templateUrl: './problem-form.component.html',
  styleUrl: './problem-form.component.css'
})
export class ProblemFormComponent implements OnInit {

  // ── inject() — Modern DI ─────────────────────────────────────
  // inject() is the MODERN way to do dependency injection.
  // Old way: constructor(private fb: FormBuilder) {}
  // New way: private fb = inject(FormBuilder);
  // Both work. inject() is newer and works outside constructors.
  private fb = inject(FormBuilder);
  private simplexService = inject(SimplexService);

  // ── Signals for Dynamic UI ────────────────────────────────────
  // numVariables controls how many coefficient inputs we show.
  // When the user changes this, the form rebuilds.
  numVariables = signal(2);

  // Expose the service's loading signal to the template
  loading = this.simplexService.loading;

  // ── The Reactive Form ─────────────────────────────────────────
  // We declare the form shape here. FormBuilder makes it clean.
  //
  // form = {
  //   objective:    'max' | 'min',
  //   coefficients: [5, 4],          ← FormArray (dynamic length)
  //   constraints:  [                ← FormArray of FormGroups
  //     {
  //       coefficients: [6, 4],      ← nested FormArray
  //       operator: '<=',
  //       rhs: 24
  //     },
  //     ...
  //   ]
  // }
  form!: FormGroup;
  // The "!" (definite assignment assertion) tells TypeScript:
  // "I promise this will be assigned before it's used" (in ngOnInit).

  // ── ngOnInit() — Lifecycle Hook ───────────────────────────────
  // Called ONCE when the component is created.
  // This is where you do initialization that depends on injected services.
  // Constructor should be kept minimal (just assign injections).
  ngOnInit(): void {
    this.buildForm();
  }

  // ── buildForm() — Create the Reactive Form ────────────────────
  // Uses FormBuilder to construct the form structure.
  private buildForm(): void {
    const n = this.numVariables();

    this.form = this.fb.group({
      // A single FormControl for max/min selection
      objective: ['max'],

      // FormArray of n number inputs for the objective function
      // e.g., for 2 variables: [FormControl(0), FormControl(0)]
      coefficients: this.fb.array(
        Array.from({ length: n }, () => this.fb.control(0, Validators.required))
      ),

      // FormArray of constraint rows (starts with 1 row)
      constraints: this.fb.array([
        this.createConstraintGroup(n)
      ])
    });
  }

  // ── createConstraintGroup() — One Constraint Row ──────────────
  // Returns a FormGroup representing one constraint like: 2x1 + 3x2 <= 10
  private createConstraintGroup(numVars: number): FormGroup {
    return this.fb.group({
      coefficients: this.fb.array(
        Array.from({ length: numVars }, () => this.fb.control(0, Validators.required))
      ),
      operator: ['<='],
      rhs: [0, Validators.required]
    });
  }

  // ── Getters for Template Access ───────────────────────────────
  // Reactive forms store data in AbstractControl objects.
  // We need to cast them to the correct type for the template.
  //
  // In the template, we can't write form.get('constraints') as FormArray
  // directly, so we provide these getter methods.

  /** Get the objective coefficients FormArray */
  get coefficientsArray(): FormArray {
    return this.form.get('coefficients') as FormArray;
  }

  /** Get the constraints FormArray */
  get constraintsArray(): FormArray {
    return this.form.get('constraints') as FormArray;
  }

  /** Get the coefficients FormArray inside a specific constraint */
  getConstraintCoefficients(index: number): FormArray {
    const constraint = this.constraintsArray.at(index) as FormGroup;
    return constraint.get('coefficients') as FormArray;
  }

  // ── Dynamic Form Actions ──────────────────────────────────────

  /** Add a new constraint row */
  addConstraint(): void {
    this.constraintsArray.push(
      this.createConstraintGroup(this.numVariables())
    );
  }

  /** Remove a constraint row by index */
  removeConstraint(index: number): void {
    if (this.constraintsArray.length > 1) {
      this.constraintsArray.removeAt(index);
    }
  }

  /** Called when user changes the number of variables */
  onVariablesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const n = Math.max(1, Math.min(10, parseInt(input.value) || 2));
    this.numVariables.set(n);
    this.buildForm();  // Rebuild the entire form with new variable count
  }

  // ── submit() — Build JSON & Call the API ──────────────────────
  //
  // This is where everything comes together:
  //   1. Read form values
  //   2. Build the LPRequest object (matches our TypeScript interface)
  //   3. Call simplexService.solve() which POSTs JSON to Flask
  //
  // 🪄 The LPRequest interface ensures the JSON structure matches
  //    what Flask expects. If you mess up the structure, TypeScript
  //    will warn you at compile time — not at runtime!
  //
  submit(): void {
    if (this.form.invalid || this.loading()) return;

    const formValue = this.form.value;

    // Build variable names: ["x1", "x2", ..., "xN"]
    const variableNames = Array.from(
      { length: this.numVariables() },
      (_, i) => `x${i + 1}`
    );

    // Build the constraints array matching our Constraint interface
    const constraints: Constraint[] = formValue.constraints.map(
      (c: any) => ({
        coefficients: c.coefficients.map(Number),
        operator: c.operator,
        rhs: Number(c.rhs)
      })
    );

    // Assemble the complete request object
    // This object matches the LPRequest interface exactly.
    // HttpClient will JSON.stringify() it automatically.
    const request: LPRequest = {
      objective: formValue.objective,
      coefficients: formValue.coefficients.map(Number),
      constraints,
      variableNames
    };

    // 🚀 Fire the API call!
    // The service handles the HTTP POST and stores the result
    // in its signals, which the other components read.
    console.log('Sending to Flask:', JSON.stringify(request, null, 2));
    this.simplexService.solve(request);
  }
}
