// ================================================================
// APP COMPONENT — app.ts (Root Component)
// ================================================================
//
// This is the ROOT COMPONENT — the top of the component tree.
// Every Angular app has exactly ONE root component.
//
// In main.ts, we call:
//   bootstrapApplication(App, appConfig)
//
// That tells Angular: "Start here. Render App inside <app-root>."
//
// 🔑 KEY CONCEPT: Component Tree
// ───────────────────────────────
// Angular apps are a TREE of components:
//
//   App (root)
//    ├── ProblemFormComponent   (user input)
//    ├── ResultsPanelComponent  (solution display)
//    └── IterationTableComponent (step-by-step)
//
// The root component imports and uses the child components
// simply by adding their selectors to its template:
//   <app-problem-form></app-problem-form>
//
// 🔑 KEY CONCEPT: Standalone Imports
// ───────────────────────────────────
// Each child component is listed in the `imports` array.
// This tells Angular's compiler: "These components can be used
// in this component's template."
//
// In OLD Angular, you'd register all components in a NgModule.
// In MODERN Angular, each component imports what it needs directly.
// ================================================================

import { Component, inject } from '@angular/core';
import { ProblemFormComponent } from './components/problem-form/problem-form.component';
import { ResultsPanelComponent } from './components/results-panel/results-panel.component';
import { IterationTableComponent } from './components/iteration-table/iteration-table.component';
import { SimplexService } from './services/simplex.service';

@Component({
  selector: 'app-root',    // Matches <app-root> in index.html

  // ── imports ─────────────────────────────────────────────────
  // List every component/module used in this component's template.
  // Without importing ProblemFormComponent, Angular won't know
  // what <app-problem-form> means and will throw an error.
  imports: [
    ProblemFormComponent,
    ResultsPanelComponent,
    IterationTableComponent,
  ],

  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // Inject the service so we can call reset() from the header
  protected simplexService = inject(SimplexService);
}
