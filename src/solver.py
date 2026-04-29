
import copy

class SimplexSolver:
    def __init__(self, objective, coefficients, constraints, variable_names):
        self.objective = objective.lower()
        self.orig_coefficients = [float(c) for c in coefficients]
        self.variable_names = list(variable_names)
        self.num_vars = len(self.orig_coefficients)
        self.is_minimisation = self.objective == "min"

        # 1. Free Variable Detection Logic
        self.restricted_vars = set()
        self.filtered_constraints = []
        for con in constraints:
            coeffs = [float(c) for c in con["coefficients"]]
            rhs = float(con["rhs"])
            op = con["operator"]
            non_zero = [(idx, val) for idx, val in enumerate(coeffs) if abs(val) > 1e-12]
            
            is_non_neg_bound = False
            if len(non_zero) == 1 and abs(rhs) < 1e-12:
                idx, val = non_zero[0]       # val is the coff
                if (val > 0 and op == ">=") or (val < 0 and op == "<="):
                    self.restricted_vars.add(idx)
                    is_non_neg_bound = True
            if not is_non_neg_bound:
                self.filtered_constraints.append(con)

        # 2. Variable Mapping
        self.var_mapping = {}
        self.all_var_names = []
        curr_col = 0
        for i in range(self.num_vars):
            name = self.variable_names[i]
            if i in self.restricted_vars:
                self.var_mapping[i] = [curr_col]
                self.all_var_names.append(name)
                curr_col += 1
            else:    # detect free variable
                self.var_mapping[i] = [curr_col, curr_col + 1]
                self.all_var_names.append(f"{name}+")
                self.all_var_names.append(f"{name}-")
                curr_col += 2
        
        self.num_decision_cols = curr_col
        self.iterations = []

    def solve(self):
        try:
            # --- PHASE I ---
            self._build_initial_tableau()
            
            # Record initial state with artificial columns
            self._record_iteration()

            status = self._run_simplex()
            if status == "unbounded":
                return {"status": "unbounded", "iterations": self.iterations}

            phase1_obj = -self.tableau[-1][-1]   # true Phase I objective value
            if phase1_obj > 1e-8:
                    return {
                "status": "infeasible",
                "message": "No feasible solution exists. Constraints are contradictory.",
                "iterations": self.iterations
            }

            # --- PHASE II ---
            self._prepare_phase_two()
            
            # Record first Phase II state (artificials now removed from header and tableau)
            self._record_iteration()

            status = self._run_simplex()
            if status == "unbounded":
                return {"status": "unbounded", "iterations": self.iterations}

            return self._extract_solution()
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    def _build_initial_tableau(self):
        col_cursor = self.num_decision_cols
        self.artificial_indices = []
        row_extras = []
        extra_names = []

        for con in self.filtered_constraints:
            op = con["operator"]
            extras = {}
            if op == "<=":
                extras['slack'] = col_cursor
                extra_names.append(f"s{len(extra_names)+1}")
                col_cursor += 1
            elif op == ">=":
                extras['surplus'] = col_cursor
                extra_names.append(f"e{len(extra_names)+1}")
                col_cursor += 1
                extras['artificial'] = col_cursor
                self.artificial_indices.append(col_cursor)
                extra_names.append(f"a{len(self.artificial_indices)}")
                col_cursor += 1
            elif op == "=":
                extras['artificial'] = col_cursor
                self.artificial_indices.append(col_cursor)
                extra_names.append(f"a{len(self.artificial_indices)}")
                col_cursor += 1
            row_extras.append(extras)

        self.current_header = self.all_var_names + extra_names + ["RHS"]
        total_cols = col_cursor + 1
        self.tableau = []
        self.basis = []

        for i, con in enumerate(self.filtered_constraints):
            row = [0.0] * total_cols
            for j, val in enumerate(con["coefficients"]):
                indices = self.var_mapping[j]
                row[indices[0]] = float(val)
                if len(indices) == 2: row[indices[1]] = -float(val)
            
            extras = row_extras[i]
            if 'slack' in extras:
                row[extras['slack']] = 1.0; self.basis.append(extras['slack'])
            elif 'artificial' in extras:
                if 'surplus' in extras: row[extras['surplus']] = -1.0
                row[extras['artificial']] = 1.0; self.basis.append(extras['artificial'])
            
            row[-1] = float(con["rhs"])
            self.tableau.append(row)

        # Phase I Objective Row
        obj_row = [0.0] * total_cols
        for acol in self.artificial_indices: obj_row[acol] = 1.0 
        self.tableau.append(obj_row)

        # Fix initial basis
        for row_idx, b_col in enumerate(self.basis):
            if b_col in self.artificial_indices:
                for c in range(total_cols): self.tableau[-1][c] -= self.tableau[row_idx][c]

    def _prepare_phase_two(self):
        # Identify columns to drop (artificials)
        cols_to_keep = [j for j in range(len(self.tableau[0])) if j not in self.artificial_indices]
        
        new_tableau = []
        for row in self.tableau[:-1]:
            new_tableau.append([row[j] for j in cols_to_keep])
        
        num_cols = len(cols_to_keep)
        obj_row = [0.0] * num_cols
        sign = 1.0 if self.is_minimisation else -1.0
        
        for j, val in enumerate(self.orig_coefficients):
            indices = self.var_mapping[j]
            obj_row[cols_to_keep.index(indices[0])] = sign * val
            if len(indices) == 2:
                obj_row[cols_to_keep.index(indices[1])] = -sign * val
        
        new_tableau.append(obj_row)
        self.tableau = new_tableau
        self.basis = [cols_to_keep.index(b) for b in self.basis]
        self.current_header = [self.current_header[j] for j in cols_to_keep]

        # Fix Phase II basis
        # first itration in phase 2 wich makes 
        for row_idx, b_col in enumerate(self.basis):
            factor = self.tableau[-1][b_col]
            for c in range(len(self.tableau[0])):
                self.tableau[-1][c] -= factor * self.tableau[row_idx][c]

    def _run_simplex(self):
        while True:
            pivot_col = self._find_pivot_column()
            if pivot_col is None: return "optimal"
            pivot_row = self._find_pivot_row(pivot_col)
            if pivot_row is None: return "unbounded"
            
            # Update the last iteration with the pivot info before moving to next
            self.iterations[-1]["pivotRow"] = pivot_row
            self.iterations[-1]["pivotColumn"] = pivot_col
            
            self._pivot(pivot_row, pivot_col)
            self._record_iteration()

    def _find_pivot_column(self):
        obj_row = self.tableau[-1]
        min_val = -1e-10
        min_col = None
        for j in range(len(obj_row) - 1):
            if obj_row[j] < min_val:
                min_val, min_col = obj_row[j], j
        return min_col

    def _find_pivot_row(self, pivot_col):
        min_ratio = float("inf")
        min_row = None
        for i in range(len(self.tableau) - 1):
            entry = self.tableau[i][pivot_col]
            if entry > 1e-10:
                ratio = self.tableau[i][-1] / entry
                if ratio < min_ratio:
                    min_ratio, min_row = ratio, i
        return min_row

    def _pivot(self, pivot_row, pivot_col):
        pivot_val = self.tableau[pivot_row][pivot_col]
        for j in range(len(self.tableau[0])):
            self.tableau[pivot_row][j] /= pivot_val
        for i in range(len(self.tableau)):
            if i == pivot_row: continue
            factor = self.tableau[i][pivot_col]
            for j in range(len(self.tableau[0])):
                self.tableau[i][j] -= factor * self.tableau[pivot_row][j]
        self.basis[pivot_row] = pivot_col

    def _record_iteration(self):
        self.iterations.append({
            "iterationNumber": len(self.iterations),
            "basisVariables": [self.current_header[b] for b in self.basis],
            "tableau": copy.deepcopy(self.tableau),
            "objectiveValue": round((-self.tableau[-1][-1]) if self.is_minimisation else self.tableau[-1][-1], 6),
            "pivotRow": None, # Will be filled by _run_simplex if another pivot occurs
            "pivotColumn": None
        })

    def _extract_solution(self):
        variables = {}
        for i, name in enumerate(self.variable_names):
            indices = self.var_mapping[i]
            vals = []
            for col_idx in indices:
                val = 0.0
                if col_idx in self.basis:
                    val = self.tableau[self.basis.index(col_idx)][-1]
                vals.append(val)
            variables[name] = round(vals[0] if len(vals) == 1 else vals[0] - vals[1], 6)

        return {
            "status": "optimal",
            "optimalValue": round((-self.tableau[-1][-1]) if self.is_minimisation else self.tableau[-1][-1], 6),
            "variables": variables,
            "iterations": self.iterations,
            "message": "Optimal solution found"
        }