// ============================================================
// MODELS (lp.models.ts)
// ============================================================
// TypeScript interfaces describe the SHAPE of data going to
// and coming from our Flask API. Think of them as contracts.
// ============================================================

/**
 * One constraint row, e.g.:  2x1 + 3x2 <= 10
 * coefficients : [2, 3]
 * operator     : "<="
 * rhs          : 10
 */
export interface Constraint {
  coefficients: number[];   // one number per variable
  operator: '<=' | '>=' | '=';
  rhs: number;
}

/**
 * The full problem we send TO the Flask API (HTTP POST body).
 * We will JSON.stringify this automatically via HttpClient.
 *
 * Example payload:
 * {
 *   "objective"      : "max",
 *   "coefficients"   : [5, 4],
 *   "constraints"    : [
 *     { "coefficients": [6, 4], "operator": "<=", "rhs": 24 },
 *     { "coefficients": [1, 2], "operator": "<=", "rhs": 6  }
 *   ],
 *   "variableNames"  : ["x1", "x2"]
 * }
 */
export interface LPRequest {
  objective: 'max' | 'min';
  coefficients: number[];        // objective function coefficients
  constraints: Constraint[];
  variableNames: string[];       // ["x1", "x2", ...]
}

/**
 * One simplex iteration (tableau row snapshot).
 * The API sends this so we can show step-by-step work.
 */
export interface SimplexIteration {
  iterationNumber: number;
  basisVariables: string[];
  tableau: number[][];           // 2-D array of the tableau
  pivotRow?: number;
  pivotColumn?: number;
  objectiveValue: number;
}

/**
 * The full response FROM the Flask API.
 * HttpClient will deserialize the JSON into this shape.
 */
export interface LPResponse {
  status: 'optimal' | 'infeasible' | 'unbounded' | 'error';
  optimalValue?: number;
  variables?: { [name: string]: number };   // e.g. { "x1": 3, "x2": 1.5 }
  iterations?: SimplexIteration[];
  message?: string;                          // error/info text
}
