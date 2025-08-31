import React from 'react';
import {
  AppShell,
  Container,
  Title,
  Badge,
  Menu,
  Burger,
  Drawer,
  Divider,
  UnstyledButton,
  Collapse
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import { IconChevronDown } from '@tabler/icons-react';
import classes from './Header.module.css';
import type { AppRoutes } from '../types';

interface HeaderProps {
  isConnected: boolean;
  appRoutes: AppRoutes;
}

interface NavigationLink {
  label: string;
  link: string;
}

interface NavigationGroup {
  label: string;
  links: NavigationLink[];
}

type NavigationItem = NavigationLink | NavigationGroup;

// Transform routes into navigation structure
const createNavigationLinks = (appRoutes: AppRoutes): NavigationItem[] => {
  const routes = Object.entries(appRoutes);
  
  // Filter out routes with parameters (e.g., :accountId, :id, etc.)
  const navigableRoutes = routes.filter(([path]) => !path.includes(':'));
  
  // Group routes by tab and create navigation structure
  const bankingRoutes = navigableRoutes.filter(([, config]) => config.tab === 'banking');
  const transactionRoutes = navigableRoutes.filter(([, config]) => config.tab === 'transaction');
  const chatRoutes = navigableRoutes.filter(([, config]) => config.tab === 'chat');

  return [
    {
      label: 'Banking',
      links: bankingRoutes.map(([path, config]) => ({
        link: path,
        label: config.breadcrumb
      }))
    },
    ...transactionRoutes.map(([path, config]) => ({
      label: config.breadcrumb,
      link: path
    })),
    ...chatRoutes.map(([path, config]) => ({
      label: config.breadcrumb,
      link: path
    }))
  ];
};



export const Header: React.FC<HeaderProps> = ({ isConnected, appRoutes }) => {
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
  const [bankingLinksOpened, { toggle: toggleBankingLinks }] = useDisclosure(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const navigationLinks = createNavigationLinks(appRoutes);

  const isActiveRoute = (link: string) => {
    if (link === '/') {
      return location.pathname === '/';
    }
    return location.pathname === link || location.pathname.startsWith(link + '/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    closeDrawer();
  };

  // Desktop navigation items
  const items = navigationLinks.map((item) => {
    if ('links' in item) {
      // Banking section with dropdown
      const menuItems = item.links.map((subItem) => (
        <Menu.Item 
          key={subItem.link} 
          onClick={() => handleNavigation(subItem.link)}
          data-active={isActiveRoute(subItem.link) || undefined}
        >
          {subItem.label}
        </Menu.Item>
      ));

      const hasActiveChild = item.links.some(subItem => isActiveRoute(subItem.link));

      return (
        <Menu key={item.label} trigger="hover" transitionProps={{ exitDuration: 0 }} withinPortal>
          <Menu.Target>
            <UnstyledButton 
              className={classes.link}
              data-active={hasActiveChild || undefined}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span className={classes.linkLabel}>{item.label}</span>
              <IconChevronDown size={14} stroke={1.5} />
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>{menuItems}</Menu.Dropdown>
        </Menu>
      );
    }

    // Single navigation item
    return (
      <UnstyledButton
        key={item.label}
        className={classes.link}
        onClick={() => handleNavigation(item.link)}
        data-active={isActiveRoute(item.link) || undefined}
      >
        {item.label}
      </UnstyledButton>
    );
  });

  // Mobile navigation
  const mobileLinks = navigationLinks.map((item) => {
    if ('links' in item) {
      // Banking section with collapsible sub-links
      const subLinks = item.links.map((subItem) => (
        <UnstyledButton
          key={subItem.link}
          className={classes.mobileSubLink}
          onClick={() => handleNavigation(subItem.link)}
          data-active={isActiveRoute(subItem.link) || undefined}
        >
          <span style={{ flex: 1, textAlign: 'left' }}>
            {subItem.label}
          </span>
        </UnstyledButton>
      ));

      const hasActiveChild = item.links.some(subItem => isActiveRoute(subItem.link));

      return (
        <div key={item.label}>
          <UnstyledButton 
            className={classes.mobileLink}
            onClick={toggleBankingLinks}
            data-active={hasActiveChild || undefined}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>
              {item.label}
            </span>
            <IconChevronDown 
              size={16} 
              className={bankingLinksOpened ? classes.chevronOpen : classes.chevron}
              style={{ marginLeft: '8px', flexShrink: 0 }}
            />
          </UnstyledButton>
          <Collapse in={bankingLinksOpened}>
            <div className={classes.mobileSubLinks}>
              {subLinks}
            </div>
          </Collapse>
        </div>
      );
    }

    return (
      <UnstyledButton
        key={item.label}
        className={classes.mobileLink}
        onClick={() => handleNavigation(item.link)}
        data-active={isActiveRoute(item.link) || undefined}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>
          {item.label}
        </span>
      </UnstyledButton>
    );
  });

  return (
    <>
      <AppShell.Header className={classes.header} data-testid="header" h={56}>
        <Container size="xl">
          <div className={classes.inner}>
            <Title order={3} className={classes.logo}>
              EBP Banking AI Prototype
            </Title>

            <div className={classes.links}>
              {items}
            </div>

            <div className={classes.statusSection}>
              <Badge 
                data-testid="connection-status"
                color={isConnected ? 'green' : 'red'} 
                variant="light"
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              
              <Burger 
                opened={drawerOpened} 
                onClick={toggleDrawer} 
                size="sm" 
                className={classes.burger}
              />
            </div>
          </div>
        </Container>
      </AppShell.Header>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        position="right"
        size={320}
        title="Navigation"
        zIndex={1000}
        overlayProps={{ opacity: 0.6 }}
        transitionProps={{
          transition: 'slide-left',
          duration: 200,
          timingFunction: 'ease'
        }}
        styles={{
          body: { padding: 0 }
        }}
      >
        <Divider />
        <nav className={classes.mobileNavigation}>
          {mobileLinks}
        </nav>
      </Drawer>
    </>
  );
};