// ================================================================
// ITERATION TABLE COMPONENT — iteration-table.component.ts
// ================================================================
//
// Shows the step-by-step Simplex tableau iterations.
// Each iteration shows the full tableau matrix with the pivot
// element highlighted.
//
// 🔑 KEY CONCEPT: Input Signals (input())
// ────────────────────────────────────────
// In MODERN Angular (v17.1+), we use signal-based inputs:
//
//   iterations = input<SimplexIteration[]>([]);
//
// This replaces the old @Input() decorator:
//   @Input() iterations: SimplexIteration[] = [];
//
// Signal inputs are READ-ONLY signals — the parent sets the value,
// and the child reads it reactively. When the parent changes the
// value, the child's template auto-updates.
//
// In the template, you read it as: iterations() — with parentheses.
//
// 🔑 KEY CONCEPT: signal() for local state
// ──────────────────────────────────────────
// We use a regular signal for expandedSteps — local UI state
// that tracks which iteration cards are expanded/collapsed.
// ================================================================

import { Component, inject, signal, computed } from '@angular/core';
import { SimplexService } from '../../services/simplex.service';
import { SimplexIteration } from '../../models/lp.models';

@Component({
  selector: 'app-iteration-table',
  imports: [],   // No special imports needed for built-in @for/@if
  templateUrl: './iteration-table.component.html',
  styleUrl: './iteration-table.component.css'
})
export class IterationTableComponent {

  private simplexService = inject(SimplexService);

  // ── Read iterations from the service's result signal ──────────
  // computed() recalculates whenever result() changes.
  iterations = computed<SimplexIteration[]>(() => {
    const r = this.simplexService.result();
    return r?.iterations ?? [];
  });

  // ── Local UI State ────────────────────────────────────────────
  // Tracks which iteration steps are expanded (by index).
  // Using a Set stored in a signal for reactive UI updates.
  expandedSteps = signal<Set<number>>(new Set());

  // ── Toggle an iteration card open/closed ──────────────────────
  toggleStep(index: number): void {
    // .update() lets you modify a signal based on its current value.
    // We create a NEW Set each time (immutability) so Angular
    // detects the change and re-renders.
    this.expandedSteps.update(current => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  // ── Check if a step is expanded ───────────────────────────────
  isExpanded(index: number): boolean {
    return this.expandedSteps().has(index);
  }

  // ── Check if a cell is the pivot element ──────────────────────
  isPivot(iteration: SimplexIteration, row: number, col: number): boolean {
    return iteration.pivotRow === row && iteration.pivotColumn === col;
  }
}
