"""
Simplex Method Solver
=====================
A from-scratch implementation of the Simplex algorithm using the Big-M method
to handle all constraint types (<=, >=, =).

This module is used by the Flask API in main.py.
"""

import copy

# Large constant for the Big-M method.
# Artificial variables get penalised by M in the objective so they
# leave the basis if a feasible solution exists.
M = 1_000_000


class SimplexSolver:
    """Solves a linear programming problem using the Simplex method.

    Parameters
    ----------
    objective : str
        ``"max"`` or ``"min"``.
    coefficients : list[float]
        Objective-function coefficients (one per decision variable).
    constraints : list[dict]
        Each dict has ``coefficients`` (list[float]), ``operator``
        (``"<="``, ``">="``, ``"="``), and ``rhs`` (float).
    variable_names : list[str]
        Human-readable names like ``["x1", "x2"]``.
    """

    def __init__(self, objective, coefficients, constraints, variable_names):
        self.objective = objective.lower()
        self.coefficients = [float(c) for c in coefficients]
        self.constraints = constraints
        self.variable_names = list(variable_names)
        self.num_vars = len(self.coefficients)

        # Will be populated during _build_initial_tableau
        self.tableau = []           # 2-D list (rows × cols)
        self.all_var_names = []     # column header names
        self.basis = []             # index into all_var_names for each row
        self.artificial_indices = []  # column indices of artificial vars
        self.iterations = []        # recorded snapshots for the UI
        self.is_minimisation = self.objective == "min"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def solve(self):
        """Run the Simplex algorithm and return an ``LPResponse`` dict."""
        try:
            self._build_initial_tableau()
            self._record_iteration()

            max_iters = 200
            for _ in range(max_iters):
                pivot_col = self._find_pivot_column()

                # Optimality reached – no negative coefficient in obj row
                if pivot_col is None:
                    break

                pivot_row = self._find_pivot_row(pivot_col)

                # Unbounded – no positive entry in pivot column
                if pivot_row is None:
                    return {
                        "status": "unbounded",
                        "message": "The problem is unbounded – the objective "
                                   "can increase without limit.",
                        "iterations": self.iterations,
                    }

                self._pivot(pivot_row, pivot_col)
                self._record_iteration(pivot_row, pivot_col)

            # Check for infeasibility (artificial var still in basis > 0)
            if self._has_artificial_in_basis():
                return {
                    "status": "infeasible",
                    "message": "No feasible solution exists for the given "
                               "constraints.",
                    "iterations": self.iterations,
                }

            return self._extract_solution()

        except Exception as exc:
            return {
                "status": "error",
                "message": f"Solver error: {exc}",
            }

    # ------------------------------------------------------------------
    # Build the initial Simplex tableau
    # ------------------------------------------------------------------

    def _build_initial_tableau(self):
        """Convert the LP into standard form and build the tableau."""
        num_constraints = len(self.constraints)

        # Determine extra columns needed
        slack_surplus_count = 0
        artificial_count = 0
        for con in self.constraints:
            op = con["operator"]
            if op == "<=":
                slack_surplus_count += 1
            elif op == ">=":
                slack_surplus_count += 1   # surplus
                artificial_count += 1      # artificial
            elif op == "=":
                artificial_count += 1      # artificial only

        total_cols = (
            self.num_vars
            + slack_surplus_count
            + artificial_count
            + 1  # RHS column
        )

        # Column names
        self.all_var_names = list(self.variable_names)
        slack_idx = 1
        surplus_idx = 1
        artificial_idx = 1
        col_map_slack = {}      # constraint index → column index
        col_map_surplus = {}
        col_map_artificial = {}

        # First pass: assign column names and indices
        col_cursor = self.num_vars
        for i, con in enumerate(self.constraints):
            op = con["operator"]
            if op == "<=":
                name = f"s{slack_idx}"
                slack_idx += 1
                self.all_var_names.append(name)
                col_map_slack[i] = col_cursor
                col_cursor += 1
            elif op == ">=":
                sname = f"e{surplus_idx}"
                surplus_idx += 1
                self.all_var_names.append(sname)
                col_map_surplus[i] = col_cursor
                col_cursor += 1

                aname = f"a{artificial_idx}"
                artificial_idx += 1
                self.all_var_names.append(aname)
                col_map_artificial[i] = col_cursor
                self.artificial_indices.append(col_cursor)
                col_cursor += 1
            elif op == "=":
                aname = f"a{artificial_idx}"
                artificial_idx += 1
                self.all_var_names.append(aname)
                col_map_artificial[i] = col_cursor
                self.artificial_indices.append(col_cursor)
                col_cursor += 1

        self.all_var_names.append("RHS")

        # Build rows (one per constraint)
        self.tableau = []
        self.basis = []

        for i, con in enumerate(self.constraints):
            row = [0.0] * total_cols
            op = con["operator"]

            # Decision-variable coefficients
            for j in range(self.num_vars):
                row[j] = float(con["coefficients"][j])

            # RHS  — ensure non-negative RHS by flipping the row if needed
            rhs = float(con["rhs"])
            if rhs < 0:
                # Multiply the entire constraint by -1 and flip the operator
                for j in range(self.num_vars):
                    row[j] = -row[j]
                rhs = -rhs
                if op == "<=":
                    op = ">="
                elif op == ">=":
                    op = "<="
                # Equality stays the same

            # Slack / surplus / artificial
            if op == "<=":
                col = col_map_slack[i]
                row[col] = 1.0
                self.basis.append(col)      # slack enters basis
            elif op == ">=":
                scol = col_map_surplus[i]
                row[scol] = -1.0            # surplus
                acol = col_map_artificial[i]
                row[acol] = 1.0             # artificial enters basis
                self.basis.append(acol)
            elif op == "=":
                acol = col_map_artificial[i]
                row[acol] = 1.0
                self.basis.append(acol)

            row[-1] = rhs
            self.tableau.append(row)

        # Objective row (last row)
        obj_row = [0.0] * total_cols

        # The simplex method always MAXIMISES internally.
        # For max c^Tx:  obj row stores -c_j  (optimality when all >= 0).
        # For min c^Tx = max (-c^Tx):  obj row stores -(-c_j) = +c_j.
        # After solving, the RHS of the obj row gives the max value;
        # for min problems we negate it back when reporting.
        sign = 1.0 if self.is_minimisation else -1.0
        for j in range(self.num_vars):
            obj_row[j] = sign * self.coefficients[j]

        # Big-M penalty for artificial variables
        for acol in self.artificial_indices:
            obj_row[acol] = M

        self.tableau.append(obj_row)

        # Eliminate artificial variables from the objective row
        # so the initial tableau is consistent.
        for row_idx, basis_col in enumerate(self.basis):
            if basis_col in self.artificial_indices:
                # Subtract M × (constraint row) from the objective row
                for c in range(total_cols):
                    self.tableau[-1][c] -= M * self.tableau[row_idx][c]

    # ------------------------------------------------------------------
    # Simplex iteration helpers
    # ------------------------------------------------------------------

    def _find_pivot_column(self):
        """Return the column index with the most negative obj-row entry,
        or ``None`` if all entries are >= 0 (optimal)."""
        obj_row = self.tableau[-1]
        min_val = -1e-10  # tolerance
        min_col = None
        # Exclude RHS (last column)
        for j in range(len(obj_row) - 1):
            if obj_row[j] < min_val:
                min_val = obj_row[j]
                min_col = j
        return min_col

    def _find_pivot_row(self, pivot_col):
        """Minimum-ratio test.  Returns row index or ``None`` (unbounded)."""
        min_ratio = float("inf")
        min_row = None
        num_rows = len(self.tableau) - 1  # exclude objective row
        for i in range(num_rows):
            entry = self.tableau[i][pivot_col]
            if entry > 1e-10:
                ratio = self.tableau[i][-1] / entry
                if ratio < min_ratio:
                    min_ratio = ratio
                    min_row = i
        return min_row

    def _pivot(self, pivot_row, pivot_col):
        """Perform row operations to make the pivot element 1 and all
        other entries in the pivot column 0."""
        pivot_val = self.tableau[pivot_row][pivot_col]
        num_cols = len(self.tableau[0])

        # Scale the pivot row
        for j in range(num_cols):
            self.tableau[pivot_row][j] /= pivot_val

        # Eliminate the pivot column from all other rows
        for i in range(len(self.tableau)):
            if i == pivot_row:
                continue
            factor = self.tableau[i][pivot_col]
            if factor == 0:
                continue
            for j in range(num_cols):
                self.tableau[i][j] -= factor * self.tableau[pivot_row][j]

        # Update basis
        self.basis[pivot_row] = pivot_col

    # ------------------------------------------------------------------
    # Iteration recording
    # ------------------------------------------------------------------

    def _record_iteration(self, pivot_row=None, pivot_col=None):
        """Snapshot the current tableau for the UI."""
        iteration = {
            "iterationNumber": len(self.iterations) + 1,
            "basisVariables": [self.all_var_names[b] for b in self.basis],
            "tableau": copy.deepcopy(self.tableau),
            "objectiveValue": round(
                (-self.tableau[-1][-1]) if self.is_minimisation
                else self.tableau[-1][-1], 6
            ),
        }
        if pivot_row is not None and pivot_col is not None:
            iteration["pivotRow"] = pivot_row
            iteration["pivotColumn"] = pivot_col
        self.iterations.append(iteration)

    # ------------------------------------------------------------------
    # Solution extraction
    # ------------------------------------------------------------------

    def _has_artificial_in_basis(self):
        """Return ``True`` if any artificial variable is still in the basis
        with a non-zero value (→ infeasible)."""
        for row_idx, col_idx in enumerate(self.basis):
            if col_idx in self.artificial_indices:
                if abs(self.tableau[row_idx][-1]) > 1e-8:
                    return True
        return False

    def _extract_solution(self):
        """Build the ``LPResponse`` dict from the final tableau."""
        variables = {}
        for j in range(self.num_vars):
            name = self.variable_names[j]
            # Check if this variable is in the basis
            if j in self.basis:
                row_idx = self.basis.index(j)
                variables[name] = round(self.tableau[row_idx][-1], 6)
            else:
                variables[name] = 0.0

        # Objective value  (obj row stores negated value for max)
        if self.is_minimisation:
            optimal_value = round(-self.tableau[-1][-1], 6)
        else:
            optimal_value = round(self.tableau[-1][-1], 6)

        return {
            "status": "optimal",
            "optimalValue": optimal_value,
            "variables": variables,
            "iterations": self.iterations,
            "message": "Optimal solution found.",
        }
