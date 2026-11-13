import { defineAppConfig } from '#imports';

const fieldFocus = {
  compoundVariants: [
    {
      color: 'primary',
      variant: ['outline', 'subtle'],
      class: 'outline-(color:--focus)/25 focus-visible:ring-(color:--focus)'
    }
  ]
};

export default defineAppConfig({
  name: 'LiveMemory App',
  ui: {
    colors: {
      primary: 'going',
      neutral: 'slate'
    },
    input: fieldFocus,
    inputMenu: fieldFocus,
    select: fieldFocus,
    textarea: fieldFocus
  }
});
