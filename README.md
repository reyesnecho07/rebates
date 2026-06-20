```
rebates
├─ backend
│  ├─ config
│  │  ├─ database.js
│  │  └─ environment.js
│  ├─ controllers
│  │  ├─ accessControlController.js
│  │  ├─ authController.js
│  │  ├─ componentController.js
│  │  ├─ databaseController.js
│  │  ├─ debugController.js
│  │  ├─ navigationController.js
│  │  ├─ navItemGroupController.js
│  │  ├─ navItemsController.js
│  │  ├─ navItemsGroupController.js
│  │  ├─ nexchemController.js
│  │  ├─ Nexchem_reportController.js
│  │  ├─ reportController.js
│  │  ├─ syncController.js
│  │  ├─ userAccessController.js
│  │  ├─ vanController.js
│  │  ├─ Van_reportController.js
│  │  ├─ vcpController.js
│  │  └─ Vcp_reportController.js
│  ├─ middleware
│  │  ├─ auth.js
│  │  ├─ authMiddleware.js
│  │  ├─ dbMiddleware.js
│  │  ├─ errorHandler.js
│  │  └─ logger.js
│  ├─ models
│  │  └─ index.js
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ routes
│  │  ├─ accessControlRoutes.js
│  │  ├─ authRoutes.js
│  │  ├─ componentRoutes.js
│  │  ├─ databaseRoutes.js
│  │  ├─ debugRoutes.js
│  │  ├─ navItemsGroupRoutes.js
│  │  ├─ navItemsRoutes.js
│  │  ├─ nexchemRoutes.js
│  │  ├─ Nexchem_dashboardRoutes.js
│  │  ├─ Nexchem_payoutRoutes.js
│  │  ├─ Nexchem_rebateRoutes.js
│  │  ├─ Nexchem_reportRoutes.js
│  │  ├─ syncRoutes.js
│  │  ├─ userAccessRoutes.js
│  │  ├─ userPreferences.js
│  │  ├─ vanRoutes.js
│  │  ├─ Van_dashboardRoutes.js
│  │  ├─ Van_payoutRoutes.js
│  │  ├─ Van_rebateRoutes.js
│  │  ├─ Van_reportRoutes.js
│  │  ├─ vcpRoutes.js
│  │  ├─ Vcp_dashboardRoutes.js
│  │  ├─ Vcp_payoutRoutes.js
│  │  ├─ Vcp_rebateRoutes.js
│  │  └─ Vcp_reportRoutes.js
│  ├─ server.js
│  ├─ services
│  │  ├─ accessControlService.js
│  │  ├─ authService.js
│  │  ├─ componentService.js
│  │  ├─ databaseService.js
│  │  ├─ navItemsGroupService.js
│  │  ├─ navItemsService.js
│  │  ├─ Nexchem_reportService.js
│  │  ├─ sapHelpers.js
│  │  ├─ SidebarDatabaseService.js
│  │  ├─ syncService.js
│  │  ├─ userService.js
│  │  ├─ Van_reportService.js
│  │  └─ Vcp_reportService.js
│  └─ utils
│     ├─ componentScanner.js
│     └─ constants.js
├─ dist
│  └─ output.css
├─ frontend
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  ├─ favicon.ico
│  │  ├─ favicon1.ico
│  │  ├─ index.html
│  │  ├─ logo.svg
│  │  ├─ logo192.png
│  │  ├─ logo512.png
│  │  ├─ manifest.json
│  │  ├─ robots.txt
│  │  └─ url_logo.png
│  ├─ README.md
│  ├─ src
│  │  ├─ AccountSetup.js
│  │  ├─ api
│  │  │  ├─ axios.js
│  │  │  └─ userPreferences.js
│  │  ├─ App.css
│  │  ├─ App.js
│  │  ├─ App.test.js
│  │  ├─ assets
│  │  │  ├─ logo.svg
│  │  │  ├─ nexchem.png
│  │  │  ├─ nexchem1.png
│  │  │  ├─ nexchemreport.png
│  │  │  ├─ profile.jpg
│  │  │  ├─ Rebate.png
│  │  │  ├─ url_logo.png
│  │  │  ├─ url_logo.svg
│  │  │  ├─ van.png
│  │  │  ├─ van1.png
│  │  │  └─ vcp.png
│  │  ├─ components
│  │  │  ├─ AuthPage.js
│  │  │  ├─ common
│  │  │  │  ├─ AccessDenied.js
│  │  │  │  ├─ CancelModal.js
│  │  │  │  ├─ ConfirmationModal.js
│  │  │  │  ├─ Loading.js
│  │  │  │  ├─ RemoveRow.js
│  │  │  │  └─ SideBarError.js
│  │  │  ├─ Dashboard
│  │  │  │  ├─ MetricCard.js
│  │  │  │  ├─ MetricCardsGrid.js
│  │  │  │  ├─ RebateProgram
│  │  │  │  │  ├─ RebateDetailsModal.js
│  │  │  │  │  └─ RebateProgramList.js
│  │  │  │  └─ StatusSummary
│  │  │  │     ├─ NexchemPayoutHistory.js
│  │  │  │     ├─ NexchemQuotaPerformance.js
│  │  │  │     ├─ NexchemTransactionRecords.js
│  │  │  │     ├─ StatusSummary.js
│  │  │  │     ├─ VanPayoutHistory.js
│  │  │  │     ├─ VanQuotaPerformance.js
│  │  │  │     ├─ VanTransactionRecords.js
│  │  │  │     ├─ VcpPayoutHistory.js
│  │  │  │     ├─ VcpQuotaPerformance.js
│  │  │  │     └─ VcpTransactionRecords.js
│  │  │  ├─ duplicationerror
│  │  │  │  ├─ DuplicationError.js
│  │  │  │  └─ index.js
│  │  │  ├─ Header.js
│  │  │  ├─ Layout.js
│  │  │  ├─ rebate
│  │  │  │  ├─ CustomerSelectionModal.js
│  │  │  │  ├─ ItemSelectionModal.js
│  │  │  │  ├─ PercentageModal.js
│  │  │  │  ├─ ProductRangeModal.js
│  │  │  │  ├─ QuotaModal.js
│  │  │  │  ├─ RangeModal.js
│  │  │  │  └─ SelectionButton.js
│  │  │  └─ Sidebar.js
│  │  ├─ config
│  │  │  └─ api.js
│  │  ├─ constants
│  │  │  └─ accessLevels.js
│  │  ├─ context
│  │  │  ├─ AccessControlContext.js
│  │  │  ├─ AuthContext.js
│  │  │  ├─ DatabaseAccessContext.js
│  │  │  ├─ ThemeContext.js
│  │  │  └─ UserContext.js
│  │  ├─ hoc
│  │  │  └─ withComponentMetadata.js
│  │  ├─ HomePage.js
│  │  ├─ hooks
│  │  │  ├─ useAccessControl.js
│  │  │  ├─ useComponentRegistration.js
│  │  │  ├─ useNavItems.js
│  │  │  └─ usePermissions.js
│  │  ├─ index.css
│  │  ├─ index.js
│  │  ├─ Logo.js
│  │  ├─ logo.svg
│  │  ├─ NEXCHEM
│  │  │  ├─ Nexchem_CustomerRecords.js
│  │  │  ├─ Nexchem_Dashboard.js
│  │  │  ├─ Nexchem_ItemRecords.js
│  │  │  ├─ Nexchem_RebateSetup.js
│  │  │  ├─ Nexchem_Reports.js
│  │  │  └─ Nexchem_SalesEmployee.js
│  │  ├─ reportWebVitals.js
│  │  ├─ services
│  │  │  ├─ accessControlService.js
│  │  │  ├─ api.js
│  │  │  ├─ componentService.js
│  │  │  ├─ databaseApi.js
│  │  │  ├─ Nexchem_reportService.js
│  │  │  ├─ Van_reportService.js
│  │  │  └─ Vcp_reportService.js
│  │  ├─ Settings.js
│  │  ├─ setupTests.js
│  │  ├─ utils
│  │  │  ├─ componentRegistry.js
│  │  │  └─ websocket.js
│  │  ├─ VAN
│  │  │  ├─ Van_CustomerRecords.js
│  │  │  ├─ Van_Dashboard.js
│  │  │  ├─ Van_ItemRecords.js
│  │  │  ├─ Van_RebateSetup.js
│  │  │  ├─ Van_Reports.js
│  │  │  └─ Van_SalesEmployee.js
│  │  └─ VCP
│  │     ├─ Vcp_CustomerRecords.js
│  │     ├─ Vcp_Dashboard.js
│  │     ├─ Vcp_ItemRecords.js
│  │     ├─ Vcp_RebateSetup.js
│  │     ├─ Vcp_Reports.js
│  │     └─ Vcp_SalesEmployee.js
│  └─ tailwind.config.js
├─ index.html
├─ package-lock.json
├─ package.json
├─ postcss.config.js
├─ README.md
└─ tailwind.config.js

```