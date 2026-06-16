import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the template heading', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: /react typescript template/i })
  ).toBeInTheDocument();
});
