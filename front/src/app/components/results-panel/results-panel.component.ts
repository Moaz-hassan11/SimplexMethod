// ================================================================
// RESULTS PANEL COMPONENT — results-panel.component.ts
// ================================================================
//
// Displays the solution returned from the Flask API.
//
// 🔑 KEY CONCEPT: Reading Signals from a Service
// ───────────────────────────────────────────────
// This component injects SimplexService and reads its signals
// (result, loading, error) directly in the template.
//
// When the service updates a signal (e.g., result.set(data)),
// Angular AUTOMATICALLY re-renders any template that reads it.
// No manual subscription, no ngOnChanges, no async pipe needed!
//
// 🔑 KEY CONCEPT: computed()
// ──────────────────────────
// A computed signal derives its value from other signals.
// It re-calculates ONLY when its dependencies change.
//
//   const doubled = computed(() => count() * 2);
//
// It's like a formula cell in Excel — it auto-updates.
//
// 🔑 KEY CONCEPT: KeyValuePipe
// ─────────────────────────────
// Our API returns variables as an object: { "x1": 3, "x2": 1.5 }
// To loop over object keys in Angular templates, we use KeyValuePipe
// which converts { key: value } into [{ key, value }, ...] array.
// ================================================================

import { Component, inject, computed } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { SimplexService } from '../../services/simplex.service';

@Component({
  selector: 'app-results-panel',
  imports: [KeyValuePipe],
  templateUrl: './results-panel.component.html',
  styleUrl: './results-panel.component.css'
})
export class ResultsPanelComponent {

  // Inject the service to read its reactive state
  private simplexService = inject(SimplexService);

  // ── Expose service signals to the template ────────────────────
  // We create local references so the template can use them.
  result  = this.simplexService.result;
  loading = this.simplexService.loading;
  error   = this.simplexService.error;

  // ── computed() — Derived signal ───────────────────────────────
  // statusClass computes the CSS class based on the result status.
  // It only recalculates when result() changes.
  statusClass = computed(() => {
    const r = this.result();
    if (!r) return '';
    switch (r.status) {
      case 'optimal':    return 'status-optimal';
      case 'infeasible': return 'status-infeasible';
      case 'unbounded':  return 'status-unbounded';
      default:           return 'status-error';
    }
  });

  // Human-readable status label
  statusLabel = computed(() => {
    const r = this.result();
    if (!r) return '';
    switch (r.status) {
      case 'optimal':    return '✅ Optimal Solution Found';
      case 'infeasible': return '❌ Problem is Infeasible';
      case 'unbounded':  return '⚠️ Problem is Unbounded';
      default:           return '⛔ Error';
    }
  });
}
