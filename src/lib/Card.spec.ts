import { render, screen } from "@testing-library/svelte";

import Card from './Card.svelte';
import SlotTester from './SlotTester.svelte'

describe("Card", () => {
  const props = {
    title: "Title",
    description: "Description"
  }

  it('renders title and description', () => {
    render(Card, { props }) 
    
    expect(screen.getByText(props.title)).not.toBeNull()
    expect(screen.getByText(props.description)).not.toBeNull()
  })

  it('renders a slot', () => {
    const { getByTestId } = render(SlotTester, {
      props: {
        Component: Card,
      }
    });
    expect(getByTestId('slot')).not.toBeNull();
  })
  
})