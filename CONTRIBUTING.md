# Contributing to UCC-MCA Intelligence Platform

Thank you for your interest in contributing to the UCC-MCA Intelligence Platform! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (v9 or higher)
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/ivi374forivi/public-record-data-scrapper.git
   cd public-record-data-scrapper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Running the Application

- **Development**: `npm run dev` - Starts the Vite dev server
- **Build**: `npm run build` - Creates a production build
- **Preview**: `npm run preview` - Preview the production build locally
- **Lint**: `npm run lint` - Run ESLint to check code quality

### Code Style

- This project uses ESLint for code quality and consistency
- Run `npm run lint` before committing to ensure your code follows the project's style guidelines
- The project uses TypeScript - ensure all type definitions are properly maintained
- Follow React best practices and hooks guidelines

### Project Structure

Please maintain the existing project structure:

```
./src
  /components     # React components
    /ui          # Reusable UI components (Radix-based)
  /lib           # Utilities and types
    /agentic     # AI agent orchestration system
  /hooks         # Custom React hooks
  /styles        # Global styles
```

## Making Changes

### Branches

- Create a new branch for each feature or bug fix
- Use descriptive branch names (e.g., `feature/export-enhancement`, `fix/health-score-calculation`)

### Commits

- Write clear, concise commit messages
- Use present tense ("Add feature" not "Added feature")
- Reference issue numbers when applicable

### Pull Requests

1. Ensure your code passes all linting checks: `npm run lint`
2. Test your changes thoroughly
3. Update documentation if you're changing functionality
4. Create a pull request with a clear description of the changes

## Code Quality

- **TypeScript**: Maintain type safety throughout the codebase
- **Components**: Keep components focused and reusable
- **Performance**: Consider performance implications of your changes
- **Accessibility**: Ensure UI components are accessible

## Testing

- Test your changes in development mode before submitting
- Verify the production build works: `npm run build && npm run preview`
- Test responsive design on different screen sizes

## Documentation

- Update the README.md if you're adding new features
- Add JSDoc comments for complex functions
- Update type definitions when modifying data structures
- Keep documentation files in the `docs/` directory current (PRD.md, AGENTIC_FORCES.md, etc.)
- See [docs/README.md](./docs/README.md) for the complete documentation structure

## Reporting Issues

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Browser and OS information
- Screenshots if applicable

## Feature Requests

We welcome feature requests! Please:

- Check if a similar request already exists
- Provide a clear use case for the feature
- Explain how it aligns with the project goals

## Questions?

If you have questions about contributing, feel free to open an issue for discussion.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT License.
