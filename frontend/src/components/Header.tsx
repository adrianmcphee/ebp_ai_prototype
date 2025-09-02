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
import type { NavigationGroup } from '../types';

interface HeaderProps {
  isConnected: boolean;
  navigationGroups: NavigationGroup[];
}



export const Header: React.FC<HeaderProps> = ({ isConnected, navigationGroups }) => {
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
  const [bankingLinksOpened, { toggle: toggleBankingLinks }] = useDisclosure(false);
  const navigate = useNavigate();
  const location = useLocation();

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
  const items = navigationGroups.map((group) => {
    const hasActiveChild = group.links.some(link => isActiveRoute(link.path));

    // Single item = direct button, multiple items = dropdown
    if (group.links.length === 1) {
      const link = group.links[0];
      return (
        <UnstyledButton
          key={group.label}
          className={classes.link}
          onClick={() => handleNavigation(link.path)}
          data-active={isActiveRoute(link.path) || undefined}
        >
          {group.label}
        </UnstyledButton>
      );
    }

    // Multiple items = dropdown menu
    const menuItems = group.links.map((link) => (
      <Menu.Item 
        key={link.path} 
        onClick={() => handleNavigation(link.path)}
        data-active={isActiveRoute(link.path) || undefined}
      >
        {link.label}
      </Menu.Item>
    ));

    return (
      <Menu key={group.label} trigger="hover" transitionProps={{ exitDuration: 0 }} withinPortal>
        <Menu.Target>
          <UnstyledButton 
            className={classes.link}
            data-active={hasActiveChild || undefined}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span className={classes.linkLabel}>{group.label}</span>
            <IconChevronDown size={14} stroke={1.5} />
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>{menuItems}</Menu.Dropdown>
      </Menu>
    );
  });

  // Mobile navigation
  const mobileLinks = navigationGroups.map((group) => {
    const hasActiveChild = group.links.some(link => isActiveRoute(link.path));

    // Single item = direct button, multiple items = collapsible
    if (group.links.length === 1) {
      const link = group.links[0];
      return (
        <UnstyledButton
          key={group.label}
          className={classes.mobileLink}
          onClick={() => handleNavigation(link.path)}
          data-active={isActiveRoute(link.path) || undefined}
        >
          <span style={{ flex: 1, textAlign: 'left' }}>
            {group.label}
          </span>
        </UnstyledButton>
      );
    }

    // Multiple items = collapsible section
    const subLinks = group.links.map((link) => (
      <UnstyledButton
        key={link.path}
        className={classes.mobileSubLink}
        onClick={() => handleNavigation(link.path)}
        data-active={isActiveRoute(link.path) || undefined}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>
          {link.label}
        </span>
      </UnstyledButton>
    ));

    return (
      <div key={group.label}>
        <UnstyledButton 
          className={classes.mobileLink}
          onClick={toggleBankingLinks}
          data-active={hasActiveChild || undefined}
        >
          <span style={{ flex: 1, textAlign: 'left' }}>
            {group.label}
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