export default {
  editor: {
    label: { en: 'Spread Cart Drawer' },
    icon: 'shopping-cart',
    categories: ['content'],
  },
  properties: {
    supabaseUrl: {
      label: { en: 'Supabase URL' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    supabaseAnonKey: {
      label: { en: 'Supabase Anon Key' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    accessToken: {
      label: { en: 'Auth Token' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    accessMode: {
      label: { en: 'Access Mode' },
      type: 'TextSelect',
      options: {
        options: [
          { value: 'public', label: { en: 'Open to Public' } },
          { value: 'members_only', label: { en: 'Members Only' } },
        ],
      },
      bindable: true,
      defaultValue: 'members_only',
    },
    isOpen: {
      label: { en: 'Open Cart' },
      type: 'OnOff',
      bindable: true,
      defaultValue: false,
    },
    refreshTrigger: {
      label: { en: 'Refresh Trigger' },
      type: 'Number',
      bindable: true,
      defaultValue: 0,
      section: 'settings',
      /* wwEditor:start */
      bindingValidation: {
        type: 'number',
        tooltip: 'Increment this value to refresh the cart (e.g. after add-to-cart from catalog).',
      },
      /* wwEditor:end */
    },
  },
  triggerEvents: [
    {
      name: 'cart:checkout',
      label: { en: 'On Checkout' },
      event: { cartId: '', subtotal: 0, itemCount: 0 },
    },
    {
      name: 'cart:updated',
      label: { en: 'On Cart Updated' },
      event: { itemCount: 0, subtotal: 0 },
    },
    {
      name: 'cart:close',
      label: { en: 'On Cart Close' },
      event: {},
    },
    {
      name: 'cart:error',
      label: { en: 'On Error' },
      event: { message: '' },
    },
  ],
};
