import React from 'react';
import { Breadcrumbs, Anchor, Text } from '@mantine/core';
import { useNavigate, useLocation } from 'react-router-dom';

interface BreadcrumbProps {
  getRouteByPath: (path: string) => { breadcrumb: string; path: string } | undefined;
  className?: string;
}

interface BreadcrumbItem {
  label: string;
  path: string;
  isCurrentPage: boolean;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ getRouteByPath, className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  /**
   * Generate breadcrumb items from current pathname using route lookup function
   */
  const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [];
  
    // Build breadcrumb path from route hierarchy
    const pathSegments = pathname.split('/').filter(Boolean);
    let currentPath = '';
    
    for (let i = 0; i < pathSegments.length; i++) {
      currentPath += '/' + pathSegments[i];
      const route = getRouteByPath(currentPath);
      
      if (route) {
        breadcrumbs.push({
          label: route.breadcrumb,
          path: currentPath,
          isCurrentPage: currentPath === pathname
        });
      }
    }
  
    // If current path doesn't match any route, add a generic current page
    const hasCurrentPage = breadcrumbs.some(b => b.isCurrentPage);
    if (!hasCurrentPage && pathSegments.length > 0) {
      // Extract last segment as fallback label
      const lastSegment = pathSegments[pathSegments.length - 1];
      const fallbackLabel = lastSegment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      breadcrumbs.push({
        label: fallbackLabel,
        path: pathname,
        isCurrentPage: true
      });
    }
  
    return breadcrumbs;
  };
  
  const breadcrumbs = generateBreadcrumbs(location.pathname);
  
  // Don't show breadcrumbs on root path unless there are child routes
  if (breadcrumbs.length <= 1 && location.pathname === '/') {
    return null;
  }

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const items = breadcrumbs.map((item) => {
    if (item.isCurrentPage) {
      return (
        <Text 
          key={item.path} 
          size="sm" 
          c="dimmed"
          fw={500}
          data-testid={`breadcrumb-current-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {item.label}
        </Text>
      );
    }

    return (
      <Anchor
        key={item.path}
        size="sm"
        href={item.path}
        onClick={(e) => {
          e.preventDefault();
          handleNavigation(item.path);
        }}
        data-testid={`breadcrumb-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        style={{ cursor: 'pointer' }}
      >
        {item.label}
      </Anchor>
    );
  });

  return (
    <Breadcrumbs 
      className={className}
      separator="/"
      data-testid="breadcrumb-navigation"
      styles={{
        breadcrumb: {
          color: 'var(--mantine-color-blue-6)',
          '&:hover': {
            color: 'var(--mantine-color-blue-8)',
            textDecoration: 'none'
          }
        },
        separator: {
          color: 'var(--mantine-color-gray-5)',
          margin: '0 8px'
        }
      }}
    >
      {items}
    </Breadcrumbs>
  );
};
