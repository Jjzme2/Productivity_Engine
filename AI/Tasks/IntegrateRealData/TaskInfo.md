# Integrate Real Data & Ollama

**Model Used:** Gemini 2.5 Pro

**Task Interpretation:**
The user's goal was to:
1. Replace all seed/placeholder data for Important Dates and Finance with live data.
2. Ensure Firebase uses the existing `.env.local` configuration for the backend.
3. Allow the selection of individual Ollama models when 'Local AI' is chosen as the Active Provider.
4. Set up an automated way to query these Firestore collections on app boot.

**Approach & Execution:**
- **Firebase/Firestore Implementation:** Modified `firestoreClient.ts` with new Constants. Updated `finance.ts` and `dates.ts` to `unshift` optimistic updates and leverage the `subscribeToCollection` listeners.
- **Ollama Integration:** Appended an `ollamaModel` ref to `useAppStore` state, and modified `SettingsView.vue` to show a model selection text input when "Local (Ollama)" is the selected AI provider.
- **Bootstrapping Data:** We discovered that real data was not loaded by default for any stores. Thus, we updated `App.vue` to trigger the `.loadTasks`, `.loadNotes`, `.loadHabits`, `.loadEvents`, and `.loadData` (for the newly integrated stores) using the "local" ID pattern present in the project.
- **TypeScript & Type fixes:** Adding `userId` to the `ImportantDate`, `Account`, `Transaction`, `Budget`, etc types caused cascading type-check errors in `FinanceView` and `DatesView`, which we subsequently corrected.
