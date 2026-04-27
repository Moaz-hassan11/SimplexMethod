// ================================================================
// SIMPLEX SERVICE — simplex.service.ts
// ================================================================
//
// 🔑 KEY CONCEPT: Services & Dependency Injection
// ────────────────────────────────────────────────
// A Service is a class that handles LOGIC separate from the UI.
// Components handle what the user SEES; services handle what
// happens BEHIND THE SCENES (API calls, data processing, etc.)
//
// @Injectable({ providedIn: 'root' })
//   → This decorator tells Angular: "Create ONE instance of this
//     service and share it across the ENTIRE app" (singleton).
//   → Any component can ask for it in its constructor.
//
// 🔑 KEY CONCEPT: HttpClient
// ──────────────────────────
// HttpClient is Angular's built-in HTTP library. It:
//   1. Automatically converts JS objects → JSON when SENDING
//   2. Automatically converts JSON → JS objects when RECEIVING
//   3. Returns Observables (async streams) instead of Promises
//
// 🔑 KEY CONCEPT: Signals
// ────────────────────────
// Signals are Angular's MODERN reactivity system (added in v16+).
// A signal is like a "reactive variable" — when its value changes,
// any template reading it automatically re-renders.
//
//   const count = signal(0);        // create with initial value
//   count();                        // READ  the value → 0
//   count.set(5);                   // WRITE a new value
//   count.update(v => v + 1);       // UPDATE based on current
//
// Signals REPLACE the old approach of:
//   - BehaviorSubject + async pipe
//   - Manual change detection
// ================================================================

import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { LPRequest, LPResponse } from '../models/lp.models';

@Injectable({
  // 'root' means Angular creates this service when the app starts
  // and keeps ONE instance alive forever (singleton pattern).
  // Any component can inject it without needing to "register" it anywhere.
  providedIn: 'root'
})
export class SimplexService {

  // ── API Configuration ─────────────────────────────────────────
  // Change this URL to match your Flask backend.
  // Flask defaults to port 5000.
  private readonly apiUrl = 'http://localhost:5000/api/solve';

  // ── Reactive State (Signals) ──────────────────────────────────
  // These signals hold our app's state. Any component that reads
  // these in its template will automatically update when they change.

  /** The API response — null until we get one */
  readonly result   = signal<LPResponse | null>(null);

  /** True while waiting for the API to respond */
  readonly loading  = signal<boolean>(false);

  /** Error message if something goes wrong */
  readonly error    = signal<string | null>(null);

  // ── Constructor (Dependency Injection) ─────────────────────────
  // Angular sees "private http: HttpClient" in the constructor and
  // AUTOMATICALLY provides the HttpClient instance we registered
  // in app.config.ts with provideHttpClient().
  //
  // This is DI in action:
  //   - We don't write: this.http = new HttpClient()  ← WRONG
  //   - Angular does it for us                        ← RIGHT
  constructor(private http: HttpClient) {}

  // ── solve() — The Main API Call ───────────────────────────────
  //
  // This method:
  //   1. Sets loading = true
  //   2. Sends an HTTP POST with JSON body to Flask
  //   3. On success: stores the response in result signal
  //   4. On error: stores the error message
  //   5. Sets loading = false either way
  //
  // 🔑 KEY CONCEPT: Observable.subscribe()
  // ───────────────────────────────────────
  // HttpClient.post() returns an Observable — a LAZY async stream.
  // Nothing happens until you call .subscribe().
  //
  // Think of it like a Netflix show:
  //   - Creating the Observable = the show exists on Netflix
  //   - Calling .subscribe()     = you press "play"
  //   - next callback            = each episode arrives
  //   - error callback           = stream crashes
  //   - complete callback        = show ends
  //
  // For HTTP calls, you always get exactly ONE "episode" (the response)
  // and then it auto-completes and auto-unsubscribes.
  //
  solve(request: LPRequest): void {
    // Reset state before making the call
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    // ── The HTTP POST Call ─────────────────────────────────────
    //
    // this.http.post<LPResponse>(url, body)
    //
    //   - <LPResponse>  : TypeScript generic — tells TS what shape
    //                     the response JSON will be (type safety!)
    //   - url           : where to send the request
    //   - body (request): the JS object to send as JSON
    //
    // 🪄 MAGIC: HttpClient automatically does:
    //   - JSON.stringify(request)   → for the request body
    //   - Sets Content-Type: application/json header
    //   - JSON.parse(response)      → for the response body
    //
    // So our LPRequest interface → becomes JSON on the wire →
    // Flask receives it with request.get_json() →
    // Flask sends back JSON → HttpClient parses it → we get LPResponse

    this.http
      .post<LPResponse>(this.apiUrl, request)
      .subscribe({
        // ✅ SUCCESS — API returned a response
        next: (response) => {
          this.result.set(response);
          this.loading.set(false);
        },

        // ❌ ERROR — Network error, server down, etc.
        error: (err: HttpErrorResponse) => {
          console.error('API Error:', err);

          // Build a user-friendly error message
          if (err.status === 0) {
            // status 0 = browser couldn't reach the server at all
            this.error.set(
              'Cannot connect to server. Make sure Flask is running on port 5000.'
            );
          } else if (err.error?.message) {
            // The Flask API sent back an error message in JSON
            this.error.set(err.error.message);
          } else {
            this.error.set(`Server error (${err.status}): ${err.statusText}`);
          }

          this.loading.set(false);
        }
      });
  }

  // ── reset() — Clear all state ─────────────────────────────────
  // Called when the user wants to start a new problem
  reset(): void {
    this.result.set(null);
    this.error.set(null);
    this.loading.set(false);
  }
}
