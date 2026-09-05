# Frontend Developer Guide

This guide provides an overview of the frontend structure for the Odoo HR System and explains where and how to integrate backend API calls to replace the current mock data.

**Note**: The frontend directory in this monorepo is named `fronted/`.

## 📁 Codebase Structure

The frontend is a React application built with Vite. Most of the development will happen inside the `fronted/src/` directory, which is structured as follows:

```text
fronted/src/
├── assets/       # Static files like images, SVGs, and global CSS.
├── components/   # Reusable UI components (buttons, modals, layout elements).
├── context/      # Global state management using React Context (`AppContext.jsx`).
├── data/         # Contains `mockData.js` which provides dummy data for the UI.
├── pages/        # Feature-based view components (e.g., auth, dashboard, payroll).
├── App.jsx       # Main application component and routing configuration.
└── main.jsx      # React DOM entry point.
```

## 🔌 Integrating APIs (Replacing Data Stubs)

The current application relies heavily on `src/data/mockData.js` to simulate a database. To connect the frontend to a real backend, you'll need to modify the following areas:

### 1. Central State (`src/context/AppContext.jsx`)
This file is the **primary location** for data initialization and manipulation. 

* **State Initialization:** Currently, React `useState` hooks are initialized with dummy data imported from `mockData.js`.
  * *Action:* Change initial states to empty arrays `[]` or `null`, and use `useEffect` hooks to `fetch()` data from your API endpoints when the provider mounts.
* **Mutations & Actions:** Functions like `login()`, `approveRequest()`, `approveAllocation()`, and `refuseRequest()` only mutate local state.
  * *Action:* Refactor these to make HTTP POST/PUT/DELETE calls to the server. Update the React state only after a successful server response.

### 2. Direct Imports in Pages (`src/pages/`)
Some page components directly import specific structures from `mockData.js` bypassing the context provider. These will also need to be updated:
* **`src/pages/auth/UserManagement.jsx`**: Directly imports `roles`.
* **`src/pages/payroll/PayrunForm.jsx`**: Directly imports `contracts` and `salaryRules`.
* **`src/pages/dashboard/Dashboard.jsx`**: Directly imports `salaryByDept` and `monthlySalaryTrend` for charts.

*Action:* Refactor these pages to fetch this data dynamically from the API, or include this data in the `AppContext` if it needs to be globally shared.

### 3. The Mock Data File (`src/data/mockData.js`)
Once all API endpoints are integrated and components are no longer relying on it, `mockData.js` can be safely removed or moved to a `tests/` directory if needed for unit testing.

## Recommended Approach
For a robust application, consider introducing a data fetching library like **React Query (@tanstack/react-query)** or **SWR**. These tools can replace much of the custom `useEffect` logic in `AppContext.jsx` by handling caching, loading states, and background refetching automatically.
