"""
Flask API Server for the Simplex Solver
========================================
Exposes a single POST endpoint that the Angular frontend calls.

Run:
    python main.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from src.solver import SimplexSolver

app = Flask(__name__)

# Allow the Angular dev server (http://localhost:4200) to call our API.
# Without CORS the browser blocks cross-origin requests.
CORS(app)


@app.route("/api/solve", methods=["POST"])
def solve():
    """Receive an LP problem as JSON, solve it, and return the result."""
    data = request.get_json(silent=True)

    if data is None:
        return jsonify({"status": "error", "message": "Invalid or missing JSON body."}), 400

    # --- Validate required fields --------------------------------
    required = ["objective", "coefficients", "constraints", "variableNames"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({
            "status": "error",
            "message": f"Missing required fields: {', '.join(missing)}"
        }), 400

    objective = data["objective"]
    if objective not in ("max", "min"):
        return jsonify({
            "status": "error",
            "message": "Objective must be 'max' or 'min'."
        }), 400

    coefficients = data["coefficients"]
    constraints = data["constraints"]
    variable_names = data["variableNames"]

    if not coefficients or not constraints:
        return jsonify({
            "status": "error",
            "message": "Coefficients and constraints must not be empty."
        }), 400

    # --- Validate each constraint --------------------------------
    for i, con in enumerate(constraints):
        if "coefficients" not in con or "operator" not in con or "rhs" not in con:
            return jsonify({
                "status": "error",
                "message": f"Constraint {i + 1} is missing required fields "
                           f"(coefficients, operator, rhs)."
            }), 400
        if con["operator"] not in ("<=", ">=", "="):
            return jsonify({
                "status": "error",
                "message": f"Constraint {i + 1} has invalid operator '{con['operator']}'. "
                           f"Must be '<=', '>=', or '='."
            }), 400

    # --- Solve ---------------------------------------------------
    solver = SimplexSolver(objective, coefficients, constraints, variable_names)
    result = solver.solve()
    return jsonify(result)


if __name__ == "__main__":
    print("=" * 50)
    print("  Simplex Solver API running on http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
