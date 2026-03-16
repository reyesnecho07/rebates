import React, { useEffect } from 'react';
import componentRegistry from '../utils/componentRegistry';

/**
 * Higher-Order Component that automatically registers component metadata
 * @param {Object} metadata - Component metadata
 * @returns {Function} HOC
 */
const withComponentMetadata = (metadata) => (WrappedComponent) => {
  const WithMetadata = (props) => {
    useEffect(() => {
      // Register component metadata when mounted
      componentRegistry.registerComponent({
        name: metadata.name || WrappedComponent.displayName || WrappedComponent.name,
        version: metadata.version || '1.0.0',
        description: metadata.description || '',
        routePath: metadata.routePath || props.routePath || window.location.pathname,
        ...metadata
      });
    }, []);

    return <WrappedComponent {...props} />;
  };

  // Set display name for debugging
  WithMetadata.displayName = `WithMetadata(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithMetadata;
};

export default withComponentMetadata;