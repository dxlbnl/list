import { DropdownMenu as BitsDropdown } from "bits-ui";

import Content from "./MenuContent.svelte";
import Item from "./MenuItem.svelte";
import Separator from "./MenuSeparator.svelte";

export const Root = BitsDropdown.Root;
export const Trigger = BitsDropdown.Trigger;
export const Group = BitsDropdown.Group;
export const Portal = BitsDropdown.Portal;
export const Sub = BitsDropdown.Sub;
export const SubTrigger = BitsDropdown.SubTrigger;
export const SubContent = BitsDropdown.SubContent;
export const CheckboxItem = BitsDropdown.CheckboxItem;
export const RadioGroup = BitsDropdown.RadioGroup;
export const RadioItem = BitsDropdown.RadioItem;

export {
	Content,
	Item,
	Separator,
	// Aliases for convenience
	Content as MenuContent,
	Item as MenuItem,
	Separator as MenuSeparator
};
