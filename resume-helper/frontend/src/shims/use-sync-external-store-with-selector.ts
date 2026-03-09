import withSelectorExports from "use-sync-external-store/shim/with-selector.js";

type WithSelectorExports = {
  useSyncExternalStoreWithSelector: (...args: any[]) => any;
};

const withSelector = withSelectorExports as WithSelectorExports;

export const useSyncExternalStoreWithSelector = withSelector.useSyncExternalStoreWithSelector;
export default withSelectorExports;
