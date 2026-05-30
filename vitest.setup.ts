// Extends Vitest's `expect` with jest-dom matchers (toBeDisabled,
// toBeInTheDocument, …). Kept out of the tsconfig build paths so `tsc -b`
// (the production build) never needs the testing-library types.
import '@testing-library/jest-dom/vitest'
