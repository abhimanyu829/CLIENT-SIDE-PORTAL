# Graph Report - start-client  (2026-09-29)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3201 nodes · 8920 edges · 183 communities (150 shown, 33 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ed1fbe75`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth
- next
- requireAdmin
- Button
- @prisma/client
- dependencies
- auditLog
- CallToAction
- DashboardLayoutClient.tsx
- queue.ts
- Badge
- cn
- enterprise-commerce-service.ts
- package.json
- AdminProductsClient.tsx
- react
- otp.ts
- ServiceVerticalShell
- service-lifecycle-service.ts
- Input
- UserProfileClient.tsx
- MyProductsClient.tsx
- createNotification
- WebhooksClient.tsx
- event-bus.ts
- ProductCard.tsx
- ServiceCampaignCenterClient.tsx
- BillingCenterClient.tsx
- CustomServiceRequestForm.tsx
- CouponsClient.tsx
- subscription-service.ts
- workers.ts
- ai-quota-service.ts
- admin/subscriptions/SubscriptionsClient.tsx
- manual-payment-verification.ts
- EmailShell
- shared/index.tsx
- subadmin-workforce.ts
- (public)/page.tsx
- auditLog
- @sentry/nextjs
- CheckoutClient.tsx
- CustomServiceDiscussionClient.tsx
- sendEmail
- SubadminManagementClient
- invoice-pdf.ts
- test-phone-otp-entry.cjs
- compilerOptions
- serializePrisma
- lucide-react
- Navbar.tsx
- PaymentsInspectionClient.tsx
- AdminServiceEditClient.tsx
- clerk-user-sync.ts
- custom-service-portal.ts
- @clerk/nextjs
- compilerOptions
- devDependencies
- getRazorpay
- (public)/layout.tsx
- service.ts
- PremiumServicesClient.tsx
- marketplace/page.tsx
- useRazorpayCheckout.ts
- product-service-profile.ts
- requireServiceOperationsAccess
- preview-token.ts
- accounts/[id]/route.ts
- service-discovery.ts
- scripts
- validateSubadminCredentialSession
- getPortalSetting
- premium-services/[slug]/page.tsx
- ServiceDiscoveryShelf.tsx
- RealtimeAdminProvider.tsx
- openai.ts
- custom-service-requests/[id]/route.ts
- dashboard/index.tsx
- requireSuperAdmin
- app/layout.tsx
- revenue/page.tsx
- content/route.ts
- dashboard/service-requests/page.tsx
- dashboard/SubscriptionsClient.tsx
- services/[slug]/page.tsx
- CRMPipeline.tsx
- dialogs.tsx
- admin/service-discovery/route.ts
- emitEvent
- PricingClient.tsx
- marketplace/index.tsx
- payment.ts
- admin/service-requests/page.tsx
- config/route.ts
- FeedbackClient.tsx
- admin/index.tsx
- api.ts
- updateEmailDeliveryState
- [slug]/checkout/page.tsx
- payments/index.tsx
- permissions.ts
- admin/emails/preview/route.ts
- [category]/page.tsx
- join-our-team/page.tsx
- marketplace/[slug]/page.tsx
- DemoTimer.tsx
- CartProvider.tsx
- revalidate.ts
- crm.ts
- AdminServiceCategoriesClient.tsx
- services/orders/page.tsx
- requests/page.tsx
- custom-service-portal/settings/route.ts
- billing-email-otp/send/route.ts
- dashboard/InvoicesClient.tsx
- [id]/TicketDetailClient.tsx
- (public)/ai-agents/page.tsx
- ai-agents/[slug]/page.tsx
- blog/page.tsx
- developers/page.tsx
- marketing/index.tsx
- subscription-guard.ts
- bcryptjs
- next-auth.d.ts
- product.ts
- crm/page.tsx
- stock/route.ts
- service-discovery/[id]/route.ts
- verify-required/page.tsx
- about/page.tsx
- blog/[slug]/page.tsx
- ProductSearch.tsx
- RichTextEditor.tsx
- BackgroundVideo
- types/auth.ts
- admin/reviews/page.tsx
- admin/services/page.tsx
- leads/page.tsx
- NeuralBackground.tsx
- chat/ChatClient.tsx
- careers/page.tsx
- ContactSalesClient
- UserTable.tsx
- dashboard/StatsRow.tsx
- RazorpayButton.tsx
- useFileUpload.ts
- sync-enterprise-schema.ts
- service-campaigns/analytics/page.tsx
- projects/ProjectsClient.tsx
- tickets/TicketsClient.tsx
- compare-products/page.tsx
- privacy/page.tsx
- terms/page.tsx
- CRMTemplate.tsx
- useSubscription.ts
- featureFlags.ts
- firebase-client.ts
- sanitize-product.ts
- migrate.js
- invoices/InvoicesClient.tsx
- dashboard/subscriptions/SubscriptionsClient.tsx
- press/page.tsx
- cookies/page.tsx
- refund-policy/page.tsx
- unauthorized/page.tsx
- PreviewConfigForm.tsx
- FeaturesGrid.tsx
- HeroSection.tsx
- PricingCards.tsx
- PreviewModal.tsx
- CheckoutButton.tsx
- CouponField.tsx
- extends
- next-env.d.ts
- seed-subscription-center.ts
- tailwindcss
- verify-home-query.ts
- getStripe

## God Nodes (most connected - your core abstractions)
1. `next` - 387 edges
2. `auth()` - 330 edges
3. `db` - 296 edges
4. `react` - 231 edges
5. `requireAdmin()` - 205 edges
6. `lucide-react` - 98 edges
7. `Button` - 97 edges
8. `cn()` - 95 edges
9. `zod` - 80 edges
10. `logger` - 79 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `auth()`  [EXTRACTED]
  app/api/admin/campaigns/route.ts → lib/auth.ts
- `GET()` --calls--> `auth()`  [EXTRACTED]
  app/api/admin/entitlements/[id]/route.ts → lib/auth.ts
- `GET()` --calls--> `auth()`  [EXTRACTED]
  app/api/credential-requests/route.ts → lib/auth.ts
- `GET()` --calls--> `auth()`  [EXTRACTED]
  app/api/custom-service-requests/route.ts → lib/auth.ts
- `POST()` --calls--> `auth()`  [EXTRACTED]
  app/api/products/[slug]/reviews/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (183 total, 33 thin omitted)

### Community 0 - "auth"
Cohesion: 0.03
Nodes (83): CredentialRequestsPage(), metadata, metadata, ProductAccessConfigPage(), metadata, ProductOwnershipsPage(), GET(), GET() (+75 more)

### Community 1 - "next"
Cohesion: 0.05
Nodes (39): patchSchema, createSchema, schema, schema, GET(), isAdmin(), actionSchema, computePeriodEnd() (+31 more)

### Community 2 - "requireAdmin"
Cohesion: 0.04
Nodes (64): DeploymentCenterPage(), metadata, AdminLayout(), UserProfilePage(), GET(), GET(), POST(), addonUpdateSchema (+56 more)

### Community 3 - "Button"
Cohesion: 0.04
Nodes (52): AdminKPIs, AdminOverviewClient(), AuditEntry, Entitlement, OwnershipsClient(), Props, STATUS_COLORS, UserManagementClient() (+44 more)

### Community 4 - "@prisma/client"
Cohesion: 0.05
Nodes (40): GET(), normalizeCachedStats(), GET(), dynamic, runtime, orderSchema, orderSchema, orderSchema (+32 more)

### Community 5 - "dependencies"
Cohesion: 0.03
Nodes (68): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, bcryptjs, bullmq, class-variance-authority, @clerk/clerk-react, @clerk/nextjs (+60 more)

### Community 6 - "auditLog"
Cohesion: 0.06
Nodes (49): bulkGenerateSchema, createCouponSchema, GET(), isAdmin(), paginationSchema, POST(), PATCH(), GET() (+41 more)

### Community 7 - "CallToAction"
Cohesion: 0.10
Nodes (42): AffiliatePage(), metadata, ApiProductsPage(), metadata, ApiReferencePage(), metadata, AutomationPage(), metadata (+34 more)

### Community 8 - "DashboardLayoutClient.tsx"
Cohesion: 0.06
Nodes (42): ChatPage(), DashboardOverview(), TicketDetailPage(), ActivityFeed(), ChatClient(), CommandPalette(), DashboardLayout(), NAV (+34 more)

### Community 9 - "queue.ts"
Cohesion: 0.08
Nodes (39): PATCH(), POST(), POST(), POST(), POST(), POST(), POST(), POST() (+31 more)

### Community 10 - "Badge"
Cohesion: 0.10
Nodes (42): DeploymentCenterClient(), applyUpgrade(), createAddon(), deleteService(), lifecycle(), load(), markUpgradePaid(), resolveRequest() (+34 more)

### Community 11 - "cn"
Cohesion: 0.07
Nodes (44): AdminLayoutClient(), AdminLayoutClientProps, AdminSidebar(), AdminSidebarProps, isNavigationAllowed(), NAV_ITEMS, NavigationItem, RealtimeAdminProvider() (+36 more)

### Community 12 - "enterprise-commerce-service.ts"
Cohesion: 0.09
Nodes (44): Card(), EcosystemControlPage(), money(), POST(), DELETE(), GET(), PATCH(), POST() (+36 more)

### Community 13 - "package.json"
Cohesion: 0.04
Nodes (51): name, private, version, autoprefixer, @clerk/clerk-react, clsx, eslint, eslint-config-next (+43 more)

### Community 14 - "AdminProductsClient.tsx"
Cohesion: 0.09
Nodes (44): addProductVersion(), createProduct(), createTier(), deleteProduct(), deleteTier(), duplicateProduct(), getProductStock(), initProductStock() (+36 more)

### Community 15 - "react"
Cohesion: 0.09
Nodes (24): InvoiceReadyEmailProps, LoginAlertEmailProps, PasswordResetEmailProps, PaymentFailedEmailProps, PreviewExpiredEmailProps, PreviewStartedEmailProps, ProductDeliveryEmailProps, RefundConfirmationEmailProps (+16 more)

### Community 16 - "otp.ts"
Cohesion: 0.11
Nodes (29): hashOtp(), POST(), POST(), POST(), DEMOS, metadata, checkSendCooldown(), generateOtp() (+21 more)

### Community 17 - "ServiceVerticalShell"
Cohesion: 0.14
Nodes (27): AIAgentsPage(), AIModelsPage(), ApisPage(), AutomationPage(), SERVICE_CENTER_CONFIG, SERVICE_CENTER_ORDER, ServiceCenterConfig, ServiceCentersPage() (+19 more)

### Community 18 - "service-lifecycle-service.ts"
Cohesion: 0.11
Nodes (31): actionSchema, POST(), PATCH(), statusSchema, POST(), GET(), POST(), POST() (+23 more)

### Community 19 - "Input"
Cohesion: 0.09
Nodes (27): AiMonitoringClient(), ModelStat, Props, TopUser, AnalyticsClient(), CohortRow, FunnelStep, MrrSummary (+19 more)

### Community 20 - "UserProfileClient.tsx"
Cohesion: 0.10
Nodes (29): Dispute, Metrics, OrdersClient(), Payment, Props, STATUS_COLORS, OrdersPage(), AdminPreviewsClient() (+21 more)

### Community 21 - "MyProductsClient.tsx"
Cohesion: 0.15
Nodes (29): CredentialRequestsClient(), CredRequest, STATUS_COLORS, TABS, Product, ProductAccessConfigClient(), CompactList(), CountdownBadge() (+21 more)

### Community 22 - "createNotification"
Cohesion: 0.13
Nodes (34): POST(), resolvePostPaymentRedirect(), verifySignature(), handleDisputeCreated(), handleOrderPaid(), handlePaymentAuthorized(), handlePaymentCaptured(), handlePaymentFailed() (+26 more)

### Community 23 - "WebhooksClient.tsx"
Cohesion: 0.13
Nodes (28): DemoSessionRow, Props, RemainingBadge(), sessionStatus(), SessionTable(), WebhooksPage(), PayloadViewer(), Props (+20 more)

### Community 24 - "event-bus.ts"
Cohesion: 0.10
Nodes (22): createCampaignSchema, GET(), paginationSchema, POST(), POST(), PATCH(), POST(), isAdmin() (+14 more)

### Community 25 - "ProductCard.tsx"
Cohesion: 0.13
Nodes (26): AgentCardData, CATEGORIES, Props, SerializedProduct, SORT_OPTIONS, TYPES, INTERVAL_LABELS, Product (+18 more)

### Community 26 - "ServiceCampaignCenterClient.tsx"
Cohesion: 0.11
Nodes (26): dynamic, ServiceCampaignCenterPage(), AudienceDetailPanel(), AutoPlayingVideo(), Campaign, CampaignCreatePanel(), Collection, CreatePanel() (+18 more)

### Community 27 - "BillingCenterClient.tsx"
Cohesion: 0.12
Nodes (27): AddonForm(), AddonService, Analytics, Badge(), BenefitManager(), BillingCenterClient(), CYCLE_LABELS, EMPTY_ADDON (+19 more)

### Community 28 - "CustomServiceRequestForm.tsx"
Cohesion: 0.11
Nodes (24): CustomServicePage(), dynamic, dynamic, FEATURES, RequestServicePage(), ALLOWED_TYPES, BUDGET_OPTIONS, CustomServiceRequestForm() (+16 more)

### Community 29 - "CouponsClient.tsx"
Cohesion: 0.16
Nodes (24): bulkGenerateCoupons(), createCampaign(), createCoupon(), deactivateCouponAction(), deleteCampaign(), deleteCoupon(), duplicateCampaign(), getCouponAnalytics() (+16 more)

### Community 30 - "subscription-service.ts"
Cohesion: 0.17
Nodes (23): POST(), PATCH(), GET(), POST(), handleSubscriptionUpdated(), POST(), POST(), POST() (+15 more)

### Community 31 - "workers.ts"
Cohesion: 0.12
Nodes (24): InvoiceEmail(), InvoiceEmailProps, DeploymentCompletedEmail, DeploymentStartedEmail, make(), RenewalReminderEmail, ServiceActivatedEmail, ServiceLifecycleEmail() (+16 more)

### Community 32 - "ai-quota-service.ts"
Cohesion: 0.15
Nodes (22): AiMonitoringPage(), dynamic, AdminOverviewPage(), dynamic, linearRegression(), DashboardData, GET(), POST() (+14 more)

### Community 33 - "admin/subscriptions/SubscriptionsClient.tsx"
Cohesion: 0.12
Nodes (22): createFeatureFlag(), saveGlobalConfiguration(), toggleFeatureFlag(), updateFeatureFlag(), SettingsPage(), FeatureFlag, Props, SettingsClient() (+14 more)

### Community 34 - "manual-payment-verification.ts"
Cohesion: 0.14
Nodes (22): POST(), reviewSchema, POST(), POST(), submitProofSchema, isPusherConfigured(), noopClient, noopServer (+14 more)

### Community 35 - "EmailShell"
Cohesion: 0.22
Nodes (25): POST(), InvoiceReadyEmail(), LoginAlertEmail(), PasswordResetEmail(), PaymentFailedEmail(), PreviewExpiredEmail(), PreviewStartedEmail(), ProductDeliveryEmail() (+17 more)

### Community 36 - "shared/index.tsx"
Cohesion: 0.07
Nodes (15): AVATAR_SIZES, AvatarProps, BADGE_STYLES, BadgeProps, BadgeVariant, CopyButtonProps, EmptyStateProps, ErrorStateProps (+7 more)

### Community 37 - "subadmin-workforce.ts"
Cohesion: 0.12
Nodes (22): loginSchema, POST(), actionForAdminRequest(), ADMIN_LANDING_ROUTES, API_RESOURCE_PREFIXES, firstAdminPathForPermissions(), matchesPrefix(), resourceForAdminApiPath() (+14 more)

### Community 38 - "(public)/page.tsx"
Cohesion: 0.13
Nodes (20): getActiveCampaign, getFeaturedProducts, getNewLaunches, getPlatformStats, getTestimonials, getTopAgents, getTopSellers, getTrendingProducts (+12 more)

### Community 39 - "auditLog"
Cohesion: 0.15
Nodes (17): createApiKey(), revokeApiKey(), revokeSession(), updateAdminRole(), AdminAuditClient(), AdminUser, ApiKey, AuditLog (+9 more)

### Community 40 - "@sentry/nextjs"
Cohesion: 0.10
Nodes (12): dynamic, GET(), SentryExampleAPIError, Page(), SentryExampleFrontendError, onRouterTransitionStart, onRequestError, register() (+4 more)

### Community 41 - "CheckoutClient.tsx"
Cohesion: 0.11
Nodes (19): Cart, CheckoutClient(), CheckoutState, EmailOtpVerifier, formatMoney(), generateCheckoutSessionId(), InitialBuyNow, intervalLabels (+11 more)

### Community 42 - "CustomServiceDiscussionClient.tsx"
Cohesion: 0.13
Nodes (20): AdminServiceRequestDetailPage(), dynamic, ALLOWED, Attachment, Avatar(), CustomServiceDiscussionClient(), onFiles(), Detail (+12 more)

### Community 43 - "sendEmail"
Cohesion: 0.14
Nodes (19): POST(), POST(), GET(), CommunicationEmail(), CommunicationEmailDetail, CommunicationEmailProps, ManualPaymentReviewAdminEmail(), ManualPaymentReviewAdminEmailProps (+11 more)

### Community 44 - "SubadminManagementClient"
Cohesion: 0.16
Nodes (20): prisma(), SubadminManagementPage(), ACTIONS, Badge(), DATE_TIME_FORMATTER, formatDateTime(), Input(), Metric() (+12 more)

### Community 45 - "invoice-pdf.ts"
Cohesion: 0.26
Nodes (17): GET(), A4, buildInvoicePdf(), buildReceiptPdf(), dateStr(), drawBenefitsAndAddons(), drawCustomerAndMeta(), drawFooter() (+9 more)

### Community 46 - "test-phone-otp-entry.cjs"
Cohesion: 0.10
Nodes (15): fs, fs, ref_fs, ref_module, ref_path, files, fs, path (+7 more)

### Community 47 - "compilerOptions"
Cohesion: 0.09
Nodes (20): compilerOptions, baseUrl, incremental, isolatedModules, module, moduleResolution, noEmit, extends (+12 more)

### Community 48 - "serializePrisma"
Cohesion: 0.18
Nodes (12): Category, NewServiceClient(), NewServicePage(), SubscriptionsPage(), AdminUsersPage(), ProjectsPage(), TicketsPage(), ProjectsClient() (+4 more)

### Community 49 - "lucide-react"
Cohesion: 0.16
Nodes (16): AdminUsersClient(), FraudBadge(), fraudScore(), Props, ROLE_COLORS, STATUS_COLORS, User, Checkbox (+8 more)

### Community 50 - "Navbar.tsx"
Cohesion: 0.13
Nodes (14): DashboardSidebar(), NAV, AnnouncementData, MEGA_MENU, Navbar(), SearchModal, QUICK_LINKS, SearchResponse (+6 more)

### Community 51 - "PaymentsInspectionClient.tsx"
Cohesion: 0.17
Nodes (18): AdminPaymentsPage(), dynamic, CheckoutFailure, CheckoutFailuresTab(), Counts, fmtDate(), fmtMoney(), PaymentRecord (+10 more)

### Community 52 - "AdminServiceEditClient.tsx"
Cohesion: 0.12
Nodes (18): AdminServiceEditClient(), Category, ContentEditor(), emptyAddon, emptyDocument, emptyFaq, emptyFeature, emptyMedia (+10 more)

### Community 53 - "clerk-user-sync.ts"
Cohesion: 0.19
Nodes (16): POST(), POST(), DashboardLayout(), AUTH_EVENTS, AuthState, toAppSession(), anonymizeDeletedClerkUser(), ClerkUserProfile (+8 more)

### Community 54 - "custom-service-portal.ts"
Cohesion: 0.19
Nodes (16): attachmentSchema, GET(), messageSchema, POST(), attachmentSchema, GET(), POST(), requestSchema (+8 more)

### Community 55 - "@clerk/nextjs"
Cohesion: 0.14
Nodes (5): ProfilePage(), ProfileClient(), ProfileUser, clerkAuralisAppearance, @clerk/nextjs

### Community 56 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 57 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, autoprefixer, eslint, eslint-config-next, pino-pretty, postcss, prisma, react-email (+11 more)

### Community 58 - "getRazorpay"
Cohesion: 0.19
Nodes (11): GET(), GET(), POST(), POST(), schema, toPaise(), GET(), GET() (+3 more)

### Community 59 - "(public)/layout.tsx"
Cohesion: 0.16
Nodes (15): getActiveCampaign(), metadata, PublicLayout(), websiteJsonLd, Footer(), FOOTER_LINKS, SOCIALS, TRUST_BADGES (+7 more)

### Community 60 - "service.ts"
Cohesion: 0.19
Nodes (16): POST(), POST(), asString(), checkRateLimit(), EmailWorkflow, enqueueEmail(), EnqueueEmailInput, isSuppressed() (+8 more)

### Community 61 - "PremiumServicesClient.tsx"
Cohesion: 0.16
Nodes (15): dynamic, metadata, PremiumServicesPage(), AddonService, CYCLE_LABELS, fmt(), PlanBenefit, PremiumService (+7 more)

### Community 62 - "marketplace/page.tsx"
Cohesion: 0.19
Nodes (13): MarketplaceClient(), getMarketplaceData, MarketplacePage(), revalidate, serialize(), toIso(), FadeUp(), FadeUpProps (+5 more)

### Community 63 - "useRazorpayCheckout.ts"
Cohesion: 0.17
Nodes (13): PreviewPage(), Props, PreviewClient(), PreviewSession, Product, AuthUser, useAuth(), CheckoutMode (+5 more)

### Community 64 - "product-service-profile.ts"
Cohesion: 0.22
Nodes (13): saveProductServiceProfile(), metadata, MyProductsPage(), CapacityGroup, DEFAULT_PRODUCT_SERVICE_PROFILE, IncludedService, isRecord(), normalizeCapacityForStorage() (+5 more)

### Community 65 - "requireServiceOperationsAccess"
Cohesion: 0.21
Nodes (13): AdminServiceAnalyticsPage(), formatMoney(), Metric(), POST(), POST(), POST(), createSchema, GET() (+5 more)

### Community 66 - "preview-token.ts"
Cohesion: 0.18
Nodes (9): POST(), GET(), DemoPage(), DemoPageProps, PreviewSandbox(), PreviewSandboxProps, PreviewTokenPayload, revokePreviewToken() (+1 more)

### Community 67 - "accounts/[id]/route.ts"
Cohesion: 0.24
Nodes (14): DELETE(), PATCH(), patchSchema, prisma(), createSchema, permissionSchema, POST(), isSubadminAction() (+6 more)

### Community 68 - "service-discovery.ts"
Cohesion: 0.22
Nodes (13): eventSchema, POST(), GET(), campaignIsLive(), DiscoveryService, ExtendedUser, getServiceDiscovery(), publicService() (+5 more)

### Community 69 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, build, db:generate, db:migrate, db:migrate:prod, db:push, db:seed, db:studio (+8 more)

### Community 70 - "validateSubadminCredentialSession"
Cohesion: 0.20
Nodes (10): createSchema, POST(), prisma(), GET(), AdminAccessClient(), AdminAccessPage(), notifySuperAdmins(), resolveSuperAdmins() (+2 more)

### Community 71 - "getPortalSetting"
Cohesion: 0.20
Nodes (12): GET(), prisma(), GET(), PATCH(), settingsSchema, applicationSchema, GET(), POST() (+4 more)

### Community 72 - "premium-services/[slug]/page.tsx"
Cohesion: 0.17
Nodes (10): dynamic, PremiumServiceDetailPage(), AddonService, CYCLE_LABELS, fmt(), PremiumService, PremiumServiceDetailClient(), Product (+2 more)

### Community 73 - "ServiceDiscoveryShelf.tsx"
Cohesion: 0.20
Nodes (13): metadata, Props, ServicesDirectoryPage(), AutoPlayingVideo(), BADGE_STYLES, BUTTON_CLASS_MAP, Discovery, POSITION_CLASS_MAP (+5 more)

### Community 74 - "RealtimeAdminProvider.tsx"
Cohesion: 0.16
Nodes (12): ALERT_EVENTS, Props, REFRESH_EVENTS, ChatRoom, ChatWindow(), ChatWindowProps, Message, getPusherClient() (+4 more)

### Community 75 - "openai.ts"
Cohesion: 0.23
Nodes (10): POST(), POST(), POST(), embeddingWorkerOptions, worker, generateEmbedding(), openai, streamChat() (+2 more)

### Community 76 - "custom-service-requests/[id]/route.ts"
Cohesion: 0.20
Nodes (11): GET(), PATCH(), statusSchema, POST(), POST(), dynamic, ServiceRequestDiscussionPage(), assertCustomServiceRequestAccess() (+3 more)

### Community 77 - "dashboard/index.tsx"
Cohesion: 0.15
Nodes (9): ActivityFeedProps, ActivityItem, AIUsageMeterProps, AnimatedValue(), BillingWidgetProps, QuickAction, StatItem, StatsWidget() (+1 more)

### Community 78 - "requireSuperAdmin"
Cohesion: 0.22
Nodes (10): AdminPaymentVerificationsPage(), dynamic, POST(), PATCH(), reviewSchema, PATCH(), prisma(), reviewSchema (+2 more)

### Community 79 - "app/layout.tsx"
Cohesion: 0.24
Nodes (9): app_globals, metadata, RootLayout(), ClerkSessionSync(), Providers(), ThemeProvider(), ThemeProviderProps, clerkAppearance (+1 more)

### Community 80 - "revenue/page.tsx"
Cohesion: 0.27
Nodes (9): CustomTooltip(), DaySale, RevenueChartClient(), TopUser, TopUsersTable(), getRevenueData(), KPICard(), metadata (+1 more)

### Community 81 - "content/route.ts"
Cohesion: 0.30
Nodes (11): baseSchema, DELETE(), entityLabel(), isAdmin(), mutateContent(), normalizeOptionalString(), parseJsonArray(), parseJsonObject() (+3 more)

### Community 82 - "dashboard/service-requests/page.tsx"
Cohesion: 0.23
Nodes (8): dynamic, MyServiceRequestsPage(), STATUS_META, StatusBadge(), timeAgo(), currency(), VendorStudioPage(), VendorOnboardingClient()

### Community 83 - "dashboard/SubscriptionsClient.tsx"
Cohesion: 0.24
Nodes (10): dynamic, SubscriptionsPage(), fmtDate(), fmtMoney(), Product, Props, STATUS_CONFIG, Subscription (+2 more)

### Community 84 - "services/[slug]/page.tsx"
Cohesion: 0.29
Nodes (7): ServiceDetailsPage(), getErrorMessage(), ServiceLeadForm(), getErrorMessage(), RequestType, ServiceRequestForm(), ServiceDiscoveryTracker()

### Community 85 - "CRMPipeline.tsx"
Cohesion: 0.17
Nodes (8): CRMPipelineProps, Lead, LeadActivity, stageColors, STAGES, ReviewWithUser, date-fns, @heroicons/react

### Community 86 - "dialogs.tsx"
Cohesion: 0.17
Nodes (7): ALERT_STYLES, ConfirmDialogProps, InlineAlertProps, NOTIF_ICON, NOTIF_TYPE_STYLE, Notification, NotificationBellProps

### Community 87 - "admin/service-discovery/route.ts"
Cohesion: 0.35
Nodes (10): admin(), campaignSchema, collectionSchema, GET(), inputJson(), nullIfEmpty(), POST(), PUT() (+2 more)

### Community 88 - "emitEvent"
Cohesion: 0.24
Nodes (9): POST(), POST(), campaignWorker, applyCoupon(), CouponValidationResult, deactivateCoupon(), validateCoupon(), buildActivityMessage() (+1 more)

### Community 89 - "PricingClient.tsx"
Cohesion: 0.24
Nodes (9): getPricingData, metadata, PricingPage(), revalidate, INTERVAL_LABELS, PricingClient(), Product, Props (+1 more)

### Community 90 - "marketplace/index.tsx"
Cohesion: 0.20
Nodes (7): FilterState, ProductFiltersProps, ReviewCardProps, SORTS, TierCardProps, TierData, TYPES

### Community 91 - "payment.ts"
Cohesion: 0.18
Nodes (10): BILLING_PERIODS, BillingPeriod, INVOICE_STATUSES, InvoiceRow, InvoiceStatus, PAYMENT_STATUSES, PaymentStatus, PaymentWithDetails (+2 more)

### Community 92 - "admin/service-requests/page.tsx"
Cohesion: 0.29
Nodes (7): AdminCustomServiceRequestControls(), AdminServiceRequestsPage(), ALL_STATUSES, dynamic, STATUS_META, StatusBadge(), timeAgo()

### Community 93 - "config/route.ts"
Cohesion: 0.24
Nodes (8): configSchema, GET(), PUT(), GET(), PATCH(), patchSchema, GET(), decryptConfig()

### Community 94 - "FeedbackClient.tsx"
Cohesion: 0.29
Nodes (7): FeedbackClient(), ProductItem, ReviewItem, FeedbackPage(), metadata, metadata, ReviewsPage()

### Community 95 - "admin/index.tsx"
Cohesion: 0.20
Nodes (7): ACTION_COLOR, AuditEntry, AuditLogTableProps, COLUMNS, Lead, LeadKanbanProps, PRIORITY_STYLE

### Community 96 - "api.ts"
Cohesion: 0.22
Nodes (9): API_ERROR_CODES, ApiErrorCode, ApiResponse, ListParams, PaginatedResponse, PartialBy, RequiredBy, Serialized (+1 more)

### Community 97 - "updateEmailDeliveryState"
Cohesion: 0.31
Nodes (7): GET(), safeDestination(), GET(), PIXEL, POST(), resolveQueueId(), updateEmailDeliveryState()

### Community 98 - "[slug]/checkout/page.tsx"
Cohesion: 0.31
Nodes (6): ServiceCheckoutPage(), Row(), Service, ServiceAddon, ServiceCheckoutClient(), ServicePlan

### Community 99 - "payments/index.tsx"
Cohesion: 0.22
Nodes (4): CheckoutFormProps, OrderSummaryProps, PaymentMethodCardProps, UpgradePromptProps

### Community 100 - "permissions.ts"
Cohesion: 0.31
Nodes (7): hasAllPermissions(), hasAnyPermission(), hasPermission(), Permission, PERMISSIONS, requirePermission(), ROLE_PERMISSIONS

### Community 101 - "admin/emails/preview/route.ts"
Cohesion: 0.36
Nodes (6): POST(), schema, POST(), schema, sendEmailPreview(), @react-email/render

### Community 102 - "[category]/page.tsx"
Cohesion: 0.29
Nodes (4): CATEGORY_META, CategoryPage(), categoryToDbFilter(), Props

### Community 103 - "join-our-team/page.tsx"
Cohesion: 0.36
Nodes (4): Field(), JoinOurTeamClient(), Status, JoinOurTeamPage()

### Community 104 - "marketplace/[slug]/page.tsx"
Cohesion: 0.39
Nodes (6): getActiveCampaignForProduct(), getProduct(), getRelated(), ProductDetailPage(), Props, ProductDetailClient()

### Community 105 - "DemoTimer.tsx"
Cohesion: 0.25
Nodes (4): DemoNavProps, DemoTimerProps, RuntimeStatusProps, TEMPLATES

### Community 106 - "CartProvider.tsx"
Cohesion: 0.39
Nodes (6): CartData, CartItem, CartSyncState, useCartSync(), CartContext, CartContextValue

### Community 108 - "crm.ts"
Cohesion: 0.25
Nodes (7): CRM_STAGES, CRMStage, CRMStats, LEAD_SOURCES, LeadCard, LeadSource, LeadWithInteractions

### Community 109 - "AdminServiceCategoriesClient.tsx"
Cohesion: 0.48
Nodes (5): AdminServiceCategoriesClient(), Category, emptyForm(), AdminServiceCategoriesPage(), toIso()

### Community 110 - "services/orders/page.tsx"
Cohesion: 0.43
Nodes (5): AdminServiceOrdersClient(), ServiceOrder, statusStyle, AdminServiceOrdersPage(), toIso()

### Community 111 - "requests/page.tsx"
Cohesion: 0.48
Nodes (5): AdminServiceRequestsClient(), ServiceRequest, StatusBadge(), AdminServiceRequestsPage(), toIso()

### Community 112 - "custom-service-portal/settings/route.ts"
Cohesion: 0.43
Nodes (6): admin(), GET(), PATCH(), schema, CUSTOM_SERVICE_PORTAL_ID, isCustomServiceAdmin()

### Community 113 - "billing-email-otp/send/route.ts"
Cohesion: 0.48
Nodes (5): generateOtp(), hashOtp(), POST(), BillingOtpEmail(), BillingOtpEmailProps

### Community 114 - "dashboard/InvoicesClient.tsx"
Cohesion: 0.48
Nodes (5): InvoicesPage(), InvoicesClient(), StatusBadge(), statusConfig, SummaryCard()

### Community 115 - "[id]/TicketDetailClient.tsx"
Cohesion: 0.29
Nodes (5): AI_SUGGESTIONS, Msg, STATUS_OPTIONS, STATUS_STYLE, Ticket

### Community 116 - "(public)/ai-agents/page.tsx"
Cohesion: 0.43
Nodes (6): AIAgentsClient(), AIAgentsPage(), getAgentData, metadata, revalidate, serialize()

### Community 117 - "ai-agents/[slug]/page.tsx"
Cohesion: 0.38
Nodes (5): AIAgentDetailPage(), getAgent(), Props, SAMPLE_CONVERSATIONS, formatCurrency()

### Community 118 - "blog/page.tsx"
Cohesion: 0.38
Nodes (6): BlogListPage(), CATEGORIES, getPosts(), GRADIENT_VARIANTS, metadata, readingTime()

### Community 119 - "developers/page.tsx"
Cohesion: 0.29
Nodes (5): CODE_EXAMPLES, FEATURES, metadata, PAIN_POINTS, STEPS

### Community 121 - "subscription-guard.ts"
Cohesion: 0.33
Nodes (5): requireAnySubscription(), requireSubscriptionTier(), SubscriptionCheckResult, Tier, TIER_RANK

### Community 122 - "bcryptjs"
Cohesion: 0.29
Nodes (3): prisma, bcryptjs, prisma

### Community 123 - "next-auth.d.ts"
Cohesion: 0.29
Nodes (6): ref_next_auth, JWT, next-auth, next-auth/jwt, Session, User

### Community 124 - "product.ts"
Cohesion: 0.29
Nodes (6): ProductAdminRow, ProductCard, ProductDetail, ProductWithTiersAndReviews, ReviewWithUser, TierDisplay

### Community 125 - "crm/page.tsx"
Cohesion: 0.47
Nodes (4): AdminCRMClient(), EmailSeq, Lead, AdminCRMPage()

### Community 126 - "stock/route.ts"
Cohesion: 0.40
Nodes (5): GET(), PATCH(), REVALIDATE_PROFILE, revalidateStockCaches(), StockAction

### Community 127 - "service-discovery/[id]/route.ts"
Cohesion: 0.60
Nodes (5): admin(), DELETE(), jsonValue(), PATCH(), deliverServiceCampaign()

### Community 128 - "verify-required/page.tsx"
Cohesion: 0.53
Nodes (4): VerifyRequiredPage(), ClerkAuthFrame(), ClerkAuthFrameProps, LoadingState()

### Community 129 - "about/page.tsx"
Cohesion: 0.33
Nodes (4): metadata, STATS, TIMELINE, VALUES

### Community 130 - "blog/[slug]/page.tsx"
Cohesion: 0.40
Nodes (3): BlogPostPage(), BlogPostProps, getRelatedPosts()

### Community 131 - "ProductSearch.tsx"
Cohesion: 0.47
Nodes (3): ProductSearch(), ProductSearchProps, useDebounce()

### Community 132 - "RichTextEditor.tsx"
Cohesion: 0.33
Nodes (4): FORMATS, HEADINGS, LISTS, RichTextEditorProps

### Community 133 - "BackgroundVideo"
Cohesion: 0.40
Nodes (4): BackgroundVideo(), fadeIn(), startFade(), hls.js

### Community 134 - "types/auth.ts"
Cohesion: 0.33
Nodes (5): SafeUser, SessionUser, UserListRow, UserProfile, UserWithSubscription

### Community 135 - "admin/reviews/page.tsx"
Cohesion: 0.60
Nodes (3): AdminReviewsPage(), ReviewModerationTable(), ReviewWithRelations

### Community 136 - "admin/services/page.tsx"
Cohesion: 0.70
Nodes (3): AdminServicesClient(), AdminServicesPage(), toIso()

### Community 137 - "leads/page.tsx"
Cohesion: 0.70
Nodes (3): AdminServiceLeadsClient(), AdminServiceLeadsPage(), toIso()

### Community 138 - "NeuralBackground.tsx"
Cohesion: 0.60
Nodes (3): AuthLayout(), NeuralBackground(), Point

### Community 139 - "chat/ChatClient.tsx"
Cohesion: 0.40
Nodes (3): AGENTS, Msg, STARTER_PROMPTS

### Community 140 - "careers/page.tsx"
Cohesion: 0.40
Nodes (3): JOBS, metadata, PERKS

### Community 141 - "ContactSalesClient"
Cohesion: 0.50
Nodes (3): ContactSalesClient(), ContactSalesPage(), metadata

### Community 142 - "UserTable.tsx"
Cohesion: 0.40
Nodes (3): ROLE_STYLE, User, UserTableProps

### Community 143 - "dashboard/StatsRow.tsx"
Cohesion: 0.50
Nodes (4): Stat, StatsRow(), StatsRowProps, trendClass()

### Community 144 - "RazorpayButton.tsx"
Cohesion: 0.50
Nodes (4): loadRazorpayScript(), RazorpayButton(), RazorpayButtonProps, Window

### Community 145 - "useFileUpload.ts"
Cohesion: 0.40
Nodes (3): UploadedFile, UploadStatus, UseFileUploadOptions

### Community 146 - "sync-enterprise-schema.ts"
Cohesion: 0.50
Nodes (4): main(), prisma, splitSqlStatements(), sql

### Community 147 - "service-campaigns/analytics/page.tsx"
Cohesion: 0.67
Nodes (3): dynamic, Metric(), ServiceCampaignAnalyticsPage()

### Community 150 - "compare-products/page.tsx"
Cohesion: 0.50
Nodes (3): ComparePage(), metadata, Props

### Community 155 - "featureFlags.ts"
Cohesion: 0.83
Nodes (3): getFeatureFlags(), getUserBucket(), isFeatureEnabled()

### Community 156 - "firebase-client.ts"
Cohesion: 0.50
Nodes (3): firebaseConfig, IMPORTANT: This module is completely independent of Clerk., firebase

### Community 157 - "sanitize-product.ts"
Cohesion: 0.67
Nodes (3): sanitizeProductForPublic(), sanitizeProductsForPublic(), SENSITIVE_PRODUCT_FIELDS

## Knowledge Gaps
- **989 isolated node(s):** `CreateNotificationParams`, `NotificationType`, `Service`, `BadgeProps`, `Permission` (+984 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1185 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `auth`, `requireAdmin`, `Button`, `@prisma/client`, `auditLog`, `CallToAction`, `DashboardLayoutClient.tsx`, `queue.ts`, `Badge`, `cn`, `enterprise-commerce-service.ts`, `package.json`, `AdminProductsClient.tsx`, `react`, `otp.ts`, `ServiceVerticalShell`, `service-lifecycle-service.ts`, `Input`, `UserProfileClient.tsx`, `MyProductsClient.tsx`, `createNotification`, `WebhooksClient.tsx`, `event-bus.ts`, `ProductCard.tsx`, `ServiceCampaignCenterClient.tsx`, `CustomServiceRequestForm.tsx`, `CouponsClient.tsx`, `subscription-service.ts`, `ai-quota-service.ts`, `admin/subscriptions/SubscriptionsClient.tsx`, `manual-payment-verification.ts`, `subadmin-workforce.ts`, `(public)/page.tsx`, `auditLog`, `@sentry/nextjs`, `CheckoutClient.tsx`, `CustomServiceDiscussionClient.tsx`, `serializePrisma`, `lucide-react`, `Navbar.tsx`, `PaymentsInspectionClient.tsx`, `AdminServiceEditClient.tsx`, `clerk-user-sync.ts`, `custom-service-portal.ts`, `@clerk/nextjs`, `getRazorpay`, `(public)/layout.tsx`, `PremiumServicesClient.tsx`, `marketplace/page.tsx`, `useRazorpayCheckout.ts`, `product-service-profile.ts`, `requireServiceOperationsAccess`, `preview-token.ts`, `accounts/[id]/route.ts`, `service-discovery.ts`, `validateSubadminCredentialSession`, `getPortalSetting`, `premium-services/[slug]/page.tsx`, `ServiceDiscoveryShelf.tsx`, `RealtimeAdminProvider.tsx`, `openai.ts`, `custom-service-requests/[id]/route.ts`, `requireSuperAdmin`, `app/layout.tsx`, `revenue/page.tsx`, `content/route.ts`, `dashboard/service-requests/page.tsx`, `dashboard/SubscriptionsClient.tsx`, `services/[slug]/page.tsx`, `admin/service-discovery/route.ts`, `PricingClient.tsx`, `marketplace/index.tsx`, `admin/service-requests/page.tsx`, `config/route.ts`, `FeedbackClient.tsx`, `updateEmailDeliveryState`, `[slug]/checkout/page.tsx`, `payments/index.tsx`, `admin/emails/preview/route.ts`, `[category]/page.tsx`, `marketplace/[slug]/page.tsx`, `revalidate.ts`, `AdminServiceCategoriesClient.tsx`, `custom-service-portal/settings/route.ts`, `billing-email-otp/send/route.ts`, `dashboard/InvoicesClient.tsx`, `[id]/TicketDetailClient.tsx`, `(public)/ai-agents/page.tsx`, `ai-agents/[slug]/page.tsx`, `blog/page.tsx`, `developers/page.tsx`, `marketing/index.tsx`, `subscription-guard.ts`, `crm/page.tsx`, `stock/route.ts`, `service-discovery/[id]/route.ts`, `verify-required/page.tsx`, `about/page.tsx`, `blog/[slug]/page.tsx`, `admin/services/page.tsx`, `careers/page.tsx`, `ContactSalesClient`, `RazorpayButton.tsx`, `service-campaigns/analytics/page.tsx`, `projects/ProjectsClient.tsx`, `tickets/TicketsClient.tsx`, `compare-products/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `dashboard/subscriptions/SubscriptionsClient.tsx`, `press/page.tsx`, `cookies/page.tsx`, `refund-policy/page.tsx`, `unauthorized/page.tsx`, `HeroSection.tsx`, `PricingCards.tsx`, `CheckoutButton.tsx`?**
  _High betweenness centrality (0.321) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `next`, `requireAdmin`, `Button`, `@prisma/client`, `CallToAction`, `DashboardLayoutClient.tsx`, `Badge`, `cn`, `package.json`, `AdminProductsClient.tsx`, `ServiceVerticalShell`, `Input`, `UserProfileClient.tsx`, `MyProductsClient.tsx`, `WebhooksClient.tsx`, `ProductCard.tsx`, `ServiceCampaignCenterClient.tsx`, `BillingCenterClient.tsx`, `CustomServiceRequestForm.tsx`, `CouponsClient.tsx`, `workers.ts`, `admin/subscriptions/SubscriptionsClient.tsx`, `EmailShell`, `shared/index.tsx`, `subadmin-workforce.ts`, `(public)/page.tsx`, `auditLog`, `@sentry/nextjs`, `CheckoutClient.tsx`, `CustomServiceDiscussionClient.tsx`, `sendEmail`, `SubadminManagementClient`, `serializePrisma`, `lucide-react`, `Navbar.tsx`, `PaymentsInspectionClient.tsx`, `AdminServiceEditClient.tsx`, `clerk-user-sync.ts`, `@clerk/nextjs`, `(public)/layout.tsx`, `PremiumServicesClient.tsx`, `marketplace/page.tsx`, `useRazorpayCheckout.ts`, `preview-token.ts`, `validateSubadminCredentialSession`, `premium-services/[slug]/page.tsx`, `ServiceDiscoveryShelf.tsx`, `RealtimeAdminProvider.tsx`, `dashboard/index.tsx`, `app/layout.tsx`, `dashboard/service-requests/page.tsx`, `dashboard/SubscriptionsClient.tsx`, `services/[slug]/page.tsx`, `CRMPipeline.tsx`, `dialogs.tsx`, `PricingClient.tsx`, `marketplace/index.tsx`, `admin/service-requests/page.tsx`, `FeedbackClient.tsx`, `admin/index.tsx`, `[slug]/checkout/page.tsx`, `payments/index.tsx`, `join-our-team/page.tsx`, `DemoTimer.tsx`, `CartProvider.tsx`, `AdminServiceCategoriesClient.tsx`, `services/orders/page.tsx`, `requests/page.tsx`, `billing-email-otp/send/route.ts`, `dashboard/InvoicesClient.tsx`, `[id]/TicketDetailClient.tsx`, `crm/page.tsx`, `verify-required/page.tsx`, `about/page.tsx`, `ProductSearch.tsx`, `RichTextEditor.tsx`, `BackgroundVideo`, `admin/reviews/page.tsx`, `admin/services/page.tsx`, `leads/page.tsx`, `NeuralBackground.tsx`, `chat/ChatClient.tsx`, `careers/page.tsx`, `UserTable.tsx`, `RazorpayButton.tsx`, `useFileUpload.ts`, `projects/ProjectsClient.tsx`, `tickets/TicketsClient.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `CRMTemplate.tsx`, `useSubscription.ts`, `invoices/InvoicesClient.tsx`, `dashboard/subscriptions/SubscriptionsClient.tsx`, `press/page.tsx`, `cookies/page.tsx`, `refund-policy/page.tsx`, `PreviewConfigForm.tsx`, `PreviewModal.tsx`, `CouponField.tsx`?**
  _High betweenness centrality (0.222) - this node is a cross-community bridge._
- **Why does `db` connect `next` to `auth`, `requireAdmin`, `Button`, `@prisma/client`, `auditLog`, `DashboardLayoutClient.tsx`, `queue.ts`, `Badge`, `enterprise-commerce-service.ts`, `AdminProductsClient.tsx`, `otp.ts`, `ServiceVerticalShell`, `service-lifecycle-service.ts`, `Input`, `UserProfileClient.tsx`, `createNotification`, `WebhooksClient.tsx`, `event-bus.ts`, `BillingCenterClient.tsx`, `CouponsClient.tsx`, `subscription-service.ts`, `workers.ts`, `ai-quota-service.ts`, `admin/subscriptions/SubscriptionsClient.tsx`, `manual-payment-verification.ts`, `subadmin-workforce.ts`, `(public)/page.tsx`, `auditLog`, `CheckoutClient.tsx`, `sendEmail`, `SubadminManagementClient`, `serializePrisma`, `PaymentsInspectionClient.tsx`, `AdminServiceEditClient.tsx`, `clerk-user-sync.ts`, `custom-service-portal.ts`, `@clerk/nextjs`, `getRazorpay`, `(public)/layout.tsx`, `service.ts`, `PremiumServicesClient.tsx`, `marketplace/page.tsx`, `useRazorpayCheckout.ts`, `product-service-profile.ts`, `requireServiceOperationsAccess`, `preview-token.ts`, `accounts/[id]/route.ts`, `service-discovery.ts`, `validateSubadminCredentialSession`, `getPortalSetting`, `premium-services/[slug]/page.tsx`, `ServiceDiscoveryShelf.tsx`, `openai.ts`, `custom-service-requests/[id]/route.ts`, `requireSuperAdmin`, `content/route.ts`, `dashboard/service-requests/page.tsx`, `dashboard/SubscriptionsClient.tsx`, `services/[slug]/page.tsx`, `admin/service-discovery/route.ts`, `emitEvent`, `PricingClient.tsx`, `admin/service-requests/page.tsx`, `config/route.ts`, `[slug]/checkout/page.tsx`, `[category]/page.tsx`, `marketplace/[slug]/page.tsx`, `AdminServiceCategoriesClient.tsx`, `services/orders/page.tsx`, `requests/page.tsx`, `custom-service-portal/settings/route.ts`, `billing-email-otp/send/route.ts`, `(public)/ai-agents/page.tsx`, `ai-agents/[slug]/page.tsx`, `blog/page.tsx`, `subscription-guard.ts`, `crm/page.tsx`, `stock/route.ts`, `service-discovery/[id]/route.ts`, `blog/[slug]/page.tsx`, `admin/reviews/page.tsx`, `admin/services/page.tsx`, `leads/page.tsx`, `service-campaigns/analytics/page.tsx`, `compare-products/page.tsx`, `featureFlags.ts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `CreateNotificationParams`, `NotificationType`, `Service` to the rest of the system?**
  _989 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `auth` be split into smaller, more focused modules?**
  _Cohesion score 0.03093525179856115 - nodes in this community are weakly interconnected._
- **Should `next` be split into smaller, more focused modules?**
  _Cohesion score 0.047369442826635605 - nodes in this community are weakly interconnected._
- **Should `requireAdmin` be split into smaller, more focused modules?**
  _Cohesion score 0.0389393215480172 - nodes in this community are weakly interconnected._