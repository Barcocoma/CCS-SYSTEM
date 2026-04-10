# Frontend Requirements Documentation

This document explains the implementation of Parts 1-6 in the CCS Profiling frontend, including the code locations, how each feature works, and how to demo it in the UI.

Build verification:
- Frontend build passes with `npm run build`.
- Verified on April 6, 2026.

## Part 1: Client-Side Routing

### Requirement
Create routes for:
- `/dashboard`
- `/users`
- `/reports`

Expected output:
- Navigation menu switches pages without reload.

### Code locations
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/package.json`

### What was implemented
- `BrowserRouter` wraps the app in `main.jsx`.
- Route definitions were added in `App.jsx` using `Routes` and `Route`.
- The app now uses real URL paths instead of only local tab state.
- Sidebar navigation now changes routes through React Router, so page transitions happen without full reload.

### How it works
- `main.jsx` enables client-side routing through `BrowserRouter`.
- `App.jsx` defines the route table:
  - `/dashboard`
  - `/users`
  - `/reports`
- When the sidebar calls `setActiveTab`, `App.jsx` converts that tab into a route path and navigates with `useNavigate()`.

### How to demo
1. Open the app.
2. Click `Dashboard`, `Student Profile`, and `Events` from the sidebar.
3. Observe that:
   - the URL changes to `/dashboard`, `/users`, or `/reports`
   - the page content changes instantly
   - the browser does not perform a full reload

## Part 2: Dynamic Routing

### Requirement
Create a dynamic route:
- `/users/:id`

Behavior:
- Clicking a user from the list opens their details page.

### Code locations
- `frontend/src/App.jsx`
- `frontend/src/components/students/StudentRecords.jsx`
- `frontend/src/components/students/StudentListRow.jsx`

### What was implemented
- A dynamic route for `/users/:id` was added in `App.jsx`.
- The student page reads the route parameter using `useParams()`.
- Clicking `View` on a student row navigates to `/users/<id>`.
- Closing the student details returns the route back to `/users`.

### How it works
- `App.jsx` includes a `Route` for `/users/:id`.
- `StudentRecords.jsx` reads `id` from the URL with `useParams()`.
- `StudentListRow.jsx` calls `onView(student.id)`.
- `StudentRecords.jsx` handles that click and runs `navigate('/users/' + studentId)`.
- After the route changes, the selected student details are fetched and shown.

### How to demo
1. Go to `Student Profile`.
2. Click `View` on any user.
3. Observe that:
   - the URL changes to `/users/<id>`
   - the student detail view opens without reload
4. Close the detail view and confirm the URL returns to `/users`.

## Part 3: Props vs State

### Requirement
Users Page:
- Store user list in state
- Pass user data to child components using props

Example flow:
- Parent (Users Page) -> Child (User Card)

### Code locations
- `frontend/src/components/students/StudentRecords.jsx`
- `frontend/src/components/students/StudentListRow.jsx`

### What was implemented
- The Users page stores the student list in state.
- Each student row was extracted into a child component.
- The parent passes each student object and action handlers into the child through props.

### How it works
- `StudentRecords.jsx` holds:
  - `const [students, setStudents] = useState([])`
- It loops through `students` and renders `StudentListRow`.
- Props passed to `StudentListRow` include:
  - `student`
  - `onView`
  - `onEdit`

This creates a clear Parent -> Child data flow.

### How to demo
1. Open `Student Profile`.
2. Explain that the table rows are rendered from parent state.
3. Show that each row is a child component receiving its data through props.
4. Click `View` or `Edit` on a row to show the prop-based callbacks working.

## Part 4: Global State Management

### Requirement
Create a global state for:
- Logged-in user (Admin/User)
- System theme or access role

Requirement:
- Show logged-in user name in all pages

### Code locations
- `frontend/src/context/SessionProvider.jsx`
- `frontend/src/App.jsx`
- `frontend/src/components/layout/Sidebar.jsx`
- `frontend/src/components/account/AccountSettingsModal.jsx`

### What was implemented
- A global session context was created in `SessionProvider.jsx`.
- Global state now stores:
  - `user`
  - `accessRole`
  - `isAdmin`
  - `viewMode`
- The logged-in username is shown in the header and sidebar across pages.
- Updating account settings updates the shared global session too.

### How it works
- `SessionProvider` reads the logged-in user from `localStorage` on startup.
- It exposes `useSession()` so any component can access the current user and role.
- `App.jsx` wraps the app with `SessionProvider`.
- `Sidebar.jsx` and `AccountSettingsModal.jsx` consume the same global session state.

### How to demo
1. Log in as `admin@example.com`.
2. Navigate across multiple pages.
3. Observe that the same username appears consistently in the header and sidebar.
4. Open account settings, change the username, save it, and show that the name updates globally.

## Part 5: Data Flow

### Requirement
Implement:
- One-way data flow (parent -> child)
- Controlled input (search user)

### Code locations
- `frontend/src/components/students/StudentRecords.jsx`
- `frontend/src/components/students/StudentSearchBar.jsx`
- `frontend/src/components/students/StudentListRow.jsx`

### What was implemented
- The Users page parent owns the search state.
- The search field was extracted into a child component.
- The parent passes the current search value and setter into the child via props.
- The student row display also uses parent -> child props.

### How it works
- `StudentRecords.jsx` owns:
  - `searchTerm`
  - `students`
- `StudentSearchBar.jsx` receives:
  - `value={searchTerm}`
  - `onChange={setSearchTerm}`
- Because the parent owns the state, the input is controlled.
- Typing updates parent state, which triggers data refresh and rerender.

### How to demo
1. Go to `Student Profile`.
2. Type into the search field.
3. Explain that:
   - the input value is controlled by parent state
   - the child input only displays and sends changes upward
   - the parent updates the student list based on that state

## Part 6: Search Filter and Role-Based Routing

### Requirement
- Add search filter in Users page
- Add role-based routing (Admin vs User view)
- Prevent access to `/reports` if not admin

### Code locations
- `frontend/src/components/students/StudentRecords.jsx`
- `frontend/src/components/students/StudentSearchBar.jsx`
- `frontend/src/context/SessionProvider.jsx`
- `frontend/src/components/routing/RoleRoute.jsx`
- `frontend/src/App.jsx`
- `frontend/src/components/layout/Sidebar.jsx`

### What was implemented
- The Users page already had a search filter, and it is now clearly structured as a controlled input.
- A reusable route guard component `RoleRoute` was added.
- The app now has an Admin vs User view concept:
  - `DEAN` = Admin
  - `CHAIR`, `FACULTY`, `SECRETARY` = User view
- `/reports` is now admin-only in the frontend.
- `/audit-logs` was also guarded as admin-only for consistency.
- The sidebar hides the `Events` route for non-admin users.

### How it works
- `StudentRecords.jsx` sends search parameters into `fetchStudents()` whenever `searchTerm` changes.
- `SessionProvider.jsx` computes:
  - `isAdmin`
  - `viewMode`
- `RoleRoute.jsx` checks whether the current user can access a route.
- `App.jsx` wraps `/reports` with `RoleRoute allow="admin"`.
- If a non-admin manually enters `/reports`, they are redirected to `/dashboard`.
- `Sidebar.jsx` only shows the `Events` menu item to `DEAN`.

### How to demo
#### Admin demo
1. Log in with `admin@example.com`.
2. Show that `Events` is visible in the sidebar.
3. Open `/reports` successfully.
4. Show that the sidebar footer displays `Admin View`.

#### User demo
1. Log in with `faculty@example.com` or `chair@example.com`.
2. Show that `Events` is not visible in the sidebar.
3. Manually enter `/reports` in the browser URL.
4. Show that the app redirects back to `/dashboard`.
5. Show that the sidebar footer displays `User View`.

## Final Verification Summary

All six parts are implemented and connected to real frontend behavior.

Verified working in code:
- Client-side routing
- Dynamic routing
- Props vs state
- Global state management
- One-way data flow and controlled input
- Search filter and role-based route protection

Verified with build:
- `npm run build` passes successfully.