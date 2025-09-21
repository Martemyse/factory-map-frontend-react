import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Editor from '../Editor';

// Mock the sunburst component
jest.mock('../Sunburst', () => {
  return function MockSunburst({ onSelect }: any) {
    return (
      <div data-testid="sunburst">
        <button onClick={() => onSelect('test-id', 'polje')}>Test Node</button>
      </div>
    );
  };
});

describe('Bring to View Functionality', () => {
  it('should render the Bring to view button', () => {
    render(<Editor />);
    const bringToViewButton = screen.getByText('Bring to view');
    expect(bringToViewButton).toBeInTheDocument();
  });

  it('should disable the Bring to view button when no annotation is selected', () => {
    render(<Editor />);
    const bringToViewButton = screen.getByText('Bring to view');
    expect(bringToViewButton).toBeDisabled();
  });

  it('should enable the Bring to view button when an annotation is selected', () => {
    render(<Editor />);
    
    // Select an annotation through the sunburst
    const testNodeButton = screen.getByText('Test Node');
    fireEvent.click(testNodeButton);
    
    const bringToViewButton = screen.getByText('Bring to view');
    expect(bringToViewButton).not.toBeDisabled();
  });
});
