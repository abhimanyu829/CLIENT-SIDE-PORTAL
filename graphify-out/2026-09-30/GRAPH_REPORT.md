# Graph Report - start-client  (2026-09-30)

## Corpus Check
- 768 files · ~1,532,028 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: (none) 6, .conf 2, .example 1)

## Summary
- 3664 nodes · 9917 edges · 207 communities (170 shown, 37 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 143 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a8186a02`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth
- lib/auth.ts
- requireAdmin
- Button
- env.ts
- dependencies
- auditLog
- PageHero
- DashboardLayoutClient.tsx
- env
- Badge
- cn
- enterprise-commerce-service.ts
- package.json
- AdminProductsClient.tsx
- react
- otp.ts
- admin-auth.ts
- service-lifecycle-service.ts
- Input
- useToast
- MyProductsClient.tsx
- createNotification
- WebhooksClient.tsx
- signature-verifier.ts
- ProductCard.tsx
- ServiceCampaignCenterClient.tsx
- BillingCenterClient.tsx
- CustomServiceRequestForm.tsx
- CouponsClient.tsx
- subscription-service.ts
- workers.ts
- cache-service.ts
- connection-service.ts
- notifications.ts
- http-boundary.ts
- shared/index.tsx
- subadmin-permission-policy.ts
- (public)/page.tsx
- AdminAuditClient.tsx
- @sentry/nextjs
- CheckoutClient.tsx
- CustomServiceDiscussionClient.tsx
- sendEmail
- SubadminManagementClient
- invoice-pdf.ts
- test-phone-otp-entry.cjs
- compilerOptions
- serializePrisma
- AdminUsersClient.tsx
- Navbar.tsx
- PaymentsInspectionClient.tsx
- AdminServiceEditClient.tsx
- clerk-user-sync.ts
- custom-service-portal.ts
- @clerk/nextjs
- compilerOptions
- devDependencies
- refund-service.ts
- (public)/layout.tsx
- service.ts
- PremiumServicesClient.tsx
- marketplace/page.tsx
- next
- product-service-profile.ts
- zod
- create/route.ts
- accounts/[id]/route.ts
- service-discovery.ts
- scripts
- subadmin-workforce.ts
- getPortalSetting
- PremiumServiceDetailClient.tsx
- ServiceDiscoveryShelf.tsx
- ChatWindow.tsx
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
- db-credential-store.ts
- emitEvent
- CountdownTimer
- marketplace/index.tsx
- payment.ts
- admin/service-requests/page.tsx
- config/route.ts
- FeedbackClient.tsx
- admin/index.tsx
- api.ts
- db.ts
- vitest
- payments/index.tsx
- permissions.ts
- admin/emails/preview/route.ts
- [category]/page.tsx
- join-our-team/page.tsx
- ProductDetailClient.tsx
- DemoTimer.tsx
- CartProvider.tsx
- revalidate.ts
- crm.ts
- AdminServiceCategoriesClient.tsx
- requireServiceOperationsAccess
- types.ts
- custom-service-portal/settings/route.ts
- What You Must Do When Invoked
- lucide-react
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
- GatewayError
- stock/route.ts
- requireApiAuth
- 🛠️ Getting Started
- [id]/upgrades/route.ts
- blog/[slug]/page.tsx
- ProductSearch.tsx
- RichTextEditor.tsx
- BackgroundVideo
- types/auth.ts
- Phase 0 — Security Baseline
- encryption.ts
- Phase 0 — Side-Effect Map
- NeuralBackground.tsx
- chat/ChatClient.tsx
- MarketplaceClient.tsx
- ContactSalesClient.tsx
- UserTable.tsx
- dashboard/StatsRow.tsx
- RazorpayButton.tsx
- useFileUpload.ts
- sync-enterprise-schema.ts
- Phase 0 — Dangerous Primitive Audit
- projects/ProjectsClient.tsx
- tickets/TicketsClient.tsx
- CallToAction
- graphify reference: extra exports and benchmark
- health.ts
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
- Phase 0 — AI Exposure Candidate Matrix
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
- centers/[slug]/page.tsx
- coupons/route.ts
- Phase 0 — Event / Queue / Worker / Cache-Reflection Map
- Phase 0 — Phase 1 Readiness Report
- Phase 0 — Risk Matrix
- vendor/page.tsx
- marketplace/ActivityFeed.tsx
- Phase 0 — Service Dependency Map
- graphify reference: query, path, explain
- ecosystem/page.tsx
- redis.ts
- sentry-example-api/route.ts
- admin-access/page.tsx
- Phase 0 — Bug / Defect Baseline
- POST
- my-products/page.tsx
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- extraction-spec.md

## God Nodes (most connected - your core abstractions)
1. `next` - 394 edges
2. `auth()` - 333 edges
3. `db` - 300 edges
4. `react` - 231 edges
5. `requireAdmin()` - 214 edges
6. `lucide-react` - 98 edges
7. `Button` - 97 edges
8. `cn()` - 95 edges
9. `zod` - 82 edges
10. `logger` - 79 edges

## Surprising Connections (you probably didn't know these)
- `Step 0 — Constrained query expansion (REQUIRED before traversal)` --references--> `auth()`  [INFERRED]
  .kiro/skills/graphify/references/query.md → lib/auth.ts
- `AI_LOW_RISK_CANDIDATE (reversible, low blast radius — good Phase 1 pilot capabilities)` --references--> `createProduct()`  [INFERRED]
  docs/agent-gateway/phase-0/AI-EXPOSURE-CANDIDATES.md → app/(admin)/admin/products/actions.ts
- `5. Known Architectural Inconsistencies (documented, not fixed — see BUG-BASELINE.md)` --references--> `requireAdmin()`  [INFERRED]
  docs/agent-gateway/phase-0/ARCHITECTURE-AUDIT.md → lib/admin-auth.ts
- `Admin vs. Team Member vs. Future Agent (illustrative, using existing enforcement only)` --references--> `requireSuperAdmin()`  [INFERRED]
  docs/agent-gateway/phase-0/AUTHORIZATION-MATRIX.md → lib/admin-auth.ts
- `Resource ownership patterns (confirmed via code, not inferred)` --references--> `getTeamMembership()`  [INFERRED]
  docs/agent-gateway/phase-0/AUTHORIZATION-MATRIX.md → app/api/teams/[id]/members/route.ts

## Import Cycles
- None detected.

## Communities (207 total, 37 thin omitted)

### Community 0 - "auth"
Cohesion: 0.03
Nodes (71): CredentialRequestsPage(), metadata, AdminPreviewsPage(), metadata, metadata, ProductAccessConfigPage(), metadata, ProductOwnershipsPage() (+63 more)

### Community 1 - "lib/auth.ts"
Cohesion: 0.06
Nodes (26): schema, POST(), schema, GET(), isAdmin(), POST(), isAdmin(), POST() (+18 more)

### Community 2 - "requireAdmin"
Cohesion: 0.03
Nodes (66): getCouponAnalytics(), DeploymentCenterPage(), metadata, dynamic, Metric(), ServiceCampaignAnalyticsPage(), UserProfilePage(), GET() (+58 more)

### Community 3 - "Button"
Cohesion: 0.04
Nodes (58): AdminKPIs, AdminOverviewClient(), EmailSeq, Lead, AuditEntry, Entitlement, OwnershipsClient(), Props (+50 more)

### Community 4 - "env.ts"
Cohesion: 0.07
Nodes (26): connection, StepLabel, STEPS, connection, DUNNING_STEPS, dunningWorker, EmailJobPayload, s3 (+18 more)

### Community 5 - "dependencies"
Cohesion: 0.03
Nodes (68): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, bcryptjs, bullmq, class-variance-authority, @clerk/clerk-react, @clerk/nextjs (+60 more)

### Community 6 - "auditLog"
Cohesion: 0.05
Nodes (52): createCampaignSchema, GET(), paginationSchema, POST(), PATCH(), GET(), PATCH(), createFlagSchema (+44 more)

### Community 7 - "PageHero"
Cohesion: 0.17
Nodes (23): AffiliatePage(), ApiProductsPage(), metadata, AutomationPage(), metadata, DocsPage(), metadata, EnterprisePage() (+15 more)

### Community 8 - "DashboardLayoutClient.tsx"
Cohesion: 0.07
Nodes (37): ChatPage(), DashboardOverview(), ActivityFeed(), ChatClient(), CommandPalette(), DashboardLayout(), NAV, NotificationDropdown() (+29 more)

### Community 9 - "env"
Cohesion: 0.27
Nodes (15): GET(), PATCH(), POST(), POST(), POST(), POST(), sendVerificationEmail(), SendVerificationEmailParams (+7 more)

### Community 10 - "Badge"
Cohesion: 0.09
Nodes (43): DeploymentCenterClient(), applyUpgrade(), createAddon(), deleteService(), lifecycle(), load(), markUpgradePaid(), resolveRequest() (+35 more)

### Community 11 - "cn"
Cohesion: 0.08
Nodes (40): AdminLayout(), AdminLayoutClient(), AdminSidebar(), isNavigationAllowed(), NAV_ITEMS, NavigationItem, RealtimeAdminProvider(), FAQAccordion() (+32 more)

### Community 12 - "enterprise-commerce-service.ts"
Cohesion: 0.15
Nodes (31): amountInMinorUnits(), POST(), stripeRecurringInterval(), orderSchema, POST(), orderSchema, POST(), orderSchema (+23 more)

### Community 13 - "package.json"
Cohesion: 0.04
Nodes (48): getStripe(), name, private, version, autoprefixer, @clerk/clerk-react, eslint, eslint-config-next (+40 more)

### Community 14 - "AdminProductsClient.tsx"
Cohesion: 0.09
Nodes (47): addProductVersion(), createProduct(), createTier(), deleteProduct(), deleteTier(), duplicateProduct(), getProductStock(), initProductStock() (+39 more)

### Community 15 - "react"
Cohesion: 0.11
Nodes (32): BillingOtpEmailProps, InvoiceEmailProps, InvoiceReadyEmailProps, LoginAlertEmail(), LoginAlertEmailProps, ManualPaymentReviewAdminEmailProps, PasswordResetEmailProps, PaymentFailedEmailProps (+24 more)

### Community 16 - "otp.ts"
Cohesion: 0.23
Nodes (21): POST(), POST(), checkSendCooldown(), generateOtp(), getRemainingAttempts(), normalizePhone(), otpAttemptsKey(), otpCooldownKey() (+13 more)

### Community 17 - "admin-auth.ts"
Cohesion: 0.17
Nodes (23): AIAgentsPage(), AIModelsPage(), ApisPage(), AutomationPage(), SERVICE_CENTER_CONFIG, SERVICE_CENTER_ORDER, ServiceCenterConfig, ServiceCentersPage() (+15 more)

### Community 18 - "service-lifecycle-service.ts"
Cohesion: 0.16
Nodes (25): actionSchema, POST(), PATCH(), statusSchema, POST(), Deployment Center / Service Lifecycle, ACTION_STATUS, addTimelineEvent() (+17 more)

### Community 19 - "Input"
Cohesion: 0.07
Nodes (37): ModelStat, Props, TopUser, AnalyticsClient(), CohortRow, FunnelStep, MrrSummary, Props (+29 more)

### Community 20 - "useToast"
Cohesion: 0.07
Nodes (45): Dispute, Metrics, OrdersClient(), Payment, Props, STATUS_COLORS, OrdersPage(), AdminPreviewsClient() (+37 more)

### Community 21 - "MyProductsClient.tsx"
Cohesion: 0.18
Nodes (25): CredentialRequestsClient(), CredRequest, STATUS_COLORS, TABS, CompactList(), CountdownBadge(), CredentialRequestDialog(), Entitlement (+17 more)

### Community 22 - "createNotification"
Cohesion: 0.17
Nodes (30): handleDisputeCreated(), handleOrderPaid(), handlePaymentAuthorized(), handlePaymentCaptured(), handlePaymentFailed(), handleRefundProcessed(), handleSubscriptionActivated(), handleSubscriptionCancelled() (+22 more)

### Community 23 - "WebhooksClient.tsx"
Cohesion: 0.12
Nodes (30): DemoSessionRow, Props, RemainingBadge(), sessionStatus(), SessionTable(), WebhooksPage(), PayloadViewer(), Props (+22 more)

### Community 24 - "signature-verifier.ts"
Cohesion: 0.08
Nodes (32): 4. Authentication architecture, BearerTokenAuthenticator, CompositeAuthenticator, getCredentialStore(), __resetCredentialStoreForTests(), checkAndConsumeNonce(), NonceCheckResult, nonceKey() (+24 more)

### Community 25 - "ProductCard.tsx"
Cohesion: 0.47
Nodes (10): ActionButtons(), CompactCard(), FeaturedCard(), GridCard(), PriceDisplay(), ProductCard(), SpotlightCard(), Stars() (+2 more)

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
Nodes (26): bulkGenerateCoupons(), createCampaign(), createCoupon(), deactivateCouponAction(), deleteCampaign(), deleteCoupon(), duplicateCampaign(), revalidateCouponCaches() (+18 more)

### Community 30 - "subscription-service.ts"
Cohesion: 0.20
Nodes (20): POST(), PATCH(), GET(), POST(), Subscriptions / Billing / Payments / Orders / Refunds, Phase 0 — Idempotency & Transaction/Consistency Matrix, activateSubscription(), cancelExpiredGracePeriods() (+12 more)

### Community 31 - "workers.ts"
Cohesion: 0.12
Nodes (34): InvoiceEmail(), InvoiceReadyEmail(), PasswordResetEmail(), PaymentFailedEmail(), PreviewExpiredEmail(), PreviewStartedEmail(), ProductDeliveryEmail(), RefundConfirmationEmail() (+26 more)

### Community 32 - "cache-service.ts"
Cohesion: 0.18
Nodes (17): AiMonitoringClient(), AiMonitoringPage(), dynamic, AdminOverviewPage(), dynamic, linearRegression(), DashboardData, GET() (+9 more)

### Community 33 - "connection-service.ts"
Cohesion: 0.09
Nodes (20): invalidateConnectionStatus(), AgentConnectionService, AgentConnectionSummary, CreateAgentConnectionInput, CreatedAgentConnectionResult, CredentialRotationResult, PrismaAgentConnectionService, toMachineIdentity() (+12 more)

### Community 34 - "notifications.ts"
Cohesion: 0.14
Nodes (22): POST(), reviewSchema, POST(), POST(), CreateNotificationParams, NotificationType, noopClient, noopServer (+14 more)

### Community 35 - "http-boundary.ts"
Cohesion: 0.09
Nodes (26): GET(), POST(), runtime, buildRequestContext(), rateLimitKeyFor(), getAuditHook(), counters, GatewayMetricsSnapshot (+18 more)

### Community 36 - "shared/index.tsx"
Cohesion: 0.07
Nodes (15): AVATAR_SIZES, AvatarProps, BADGE_STYLES, BadgeProps, BadgeVariant, CopyButtonProps, EmptyStateProps, ErrorStateProps (+7 more)

### Community 37 - "subadmin-permission-policy.ts"
Cohesion: 0.11
Nodes (21): AdminLayoutClientProps, AdminSidebarProps, Subadmin permission matrix (resource × action), Phase 0 — Future Agent Threat Model, Threats explicitly out of scope for this system today (confirmed absent, not overlooked), AdminSession, actionForAdminRequest(), ADMIN_LANDING_ROUTES (+13 more)

### Community 38 - "(public)/page.tsx"
Cohesion: 0.18
Nodes (15): getActiveCampaign, getFeaturedProducts, getNewLaunches, getPlatformStats, getTestimonials, getTopAgents, getTopSellers, getTrendingProducts (+7 more)

### Community 39 - "AdminAuditClient.tsx"
Cohesion: 0.23
Nodes (11): createApiKey(), revokeApiKey(), revokeSession(), updateAdminRole(), AdminAuditClient(), AdminUser, ApiKey, AuditLog (+3 more)

### Community 40 - "@sentry/nextjs"
Cohesion: 0.13
Nodes (9): Page(), SentryExampleFrontendError, onRouterTransitionStart, onRequestError, register(), nextConfig, securityHeaders, { withSentryConfig } (+1 more)

### Community 41 - "CheckoutClient.tsx"
Cohesion: 0.11
Nodes (19): Cart, CheckoutClient(), CheckoutState, EmailOtpVerifier, formatMoney(), generateCheckoutSessionId(), InitialBuyNow, intervalLabels (+11 more)

### Community 42 - "CustomServiceDiscussionClient.tsx"
Cohesion: 0.13
Nodes (20): dynamic, ServiceRequestDiscussionPage(), ALLOWED, Attachment, Avatar(), CustomServiceDiscussionClient(), onFiles(), Detail (+12 more)

### Community 43 - "sendEmail"
Cohesion: 0.12
Nodes (24): actionSchema, POST(), generateOtp(), hashOtp(), POST(), POST(), submitLeadSchema, GET() (+16 more)

### Community 44 - "SubadminManagementClient"
Cohesion: 0.18
Nodes (18): ACTIONS, Badge(), DATE_TIME_FORMATTER, formatDateTime(), Input(), Metric(), Panel(), PermissionGrid() (+10 more)

### Community 45 - "invoice-pdf.ts"
Cohesion: 0.18
Nodes (22): GET(), A4, buildInvoicePdf(), buildReceiptPdf(), dateStr(), drawBenefitsAndAddons(), drawCustomerAndMeta(), drawFooter() (+14 more)

### Community 46 - "test-phone-otp-entry.cjs"
Cohesion: 0.09
Nodes (15): fs, fs, ref_fs, ref_module, ref_path, files, fs, path (+7 more)

### Community 47 - "compilerOptions"
Cohesion: 0.09
Nodes (20): compilerOptions, baseUrl, incremental, isolatedModules, module, moduleResolution, noEmit, extends (+12 more)

### Community 48 - "serializePrisma"
Cohesion: 0.06
Nodes (39): AdminCRMClient(), AdminCRMPage(), AdminServicesClient(), EditServicePage(), Category, NewServiceClient(), NewServicePage(), AdminServicesPage() (+31 more)

### Community 49 - "AdminUsersClient.tsx"
Cohesion: 0.16
Nodes (17): AdminUsersClient(), FraudBadge(), fraudScore(), Props, ROLE_COLORS, STATUS_COLORS, User, Checkbox (+9 more)

### Community 50 - "Navbar.tsx"
Cohesion: 0.13
Nodes (14): DashboardSidebar(), NAV, AnnouncementData, MEGA_MENU, Navbar(), SearchModal, QUICK_LINKS, SearchResponse (+6 more)

### Community 51 - "PaymentsInspectionClient.tsx"
Cohesion: 0.17
Nodes (18): AdminPaymentsPage(), dynamic, CheckoutFailure, CheckoutFailuresTab(), Counts, fmtDate(), fmtMoney(), PaymentRecord (+10 more)

### Community 52 - "AdminServiceEditClient.tsx"
Cohesion: 0.12
Nodes (17): AdminServiceEditClient(), Category, ContentEditor(), emptyAddon, emptyDocument, emptyFaq, emptyFeature, emptyMedia (+9 more)

### Community 53 - "clerk-user-sync.ts"
Cohesion: 0.19
Nodes (16): POST(), POST(), DashboardLayout(), AUTH_EVENTS, AuthState, toAppSession(), anonymizeDeletedClerkUser(), ClerkUserProfile (+8 more)

### Community 54 - "custom-service-portal.ts"
Cohesion: 0.17
Nodes (18): attachmentSchema, GET(), messageSchema, POST(), attachmentSchema, GET(), POST(), requestSchema (+10 more)

### Community 55 - "@clerk/nextjs"
Cohesion: 0.13
Nodes (7): VerifyRequiredPage(), ClerkAuthFrame(), ClerkAuthFrameProps, LoadingState(), clerkAppearance, clerkAuralisAppearance, @clerk/nextjs

### Community 56 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 57 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, autoprefixer, eslint, eslint-config-next, pino-pretty, postcss, prisma, react-email (+12 more)

### Community 58 - "refund-service.ts"
Cohesion: 0.10
Nodes (22): POST(), PATCH(), GET(), GET(), POST(), POST(), isAdmin(), POST() (+14 more)

### Community 59 - "(public)/layout.tsx"
Cohesion: 0.16
Nodes (15): getActiveCampaign(), metadata, PublicLayout(), websiteJsonLd, Footer(), FOOTER_LINKS, SOCIALS, TRUST_BADGES (+7 more)

### Community 60 - "service.ts"
Cohesion: 0.10
Nodes (28): POST(), POST(), GET(), safeDestination(), GET(), PIXEL, POST(), requestSchema (+20 more)

### Community 61 - "PremiumServicesClient.tsx"
Cohesion: 0.21
Nodes (12): AddonService, CYCLE_LABELS, fmt(), PlanBenefit, PremiumService, PremiumServicesClient(), ServiceCard(), ServiceCategory (+4 more)

### Community 62 - "marketplace/page.tsx"
Cohesion: 0.24
Nodes (11): MarketplaceClient(), getMarketplaceData, MarketplacePage(), revalidate, serialize(), toIso(), FadeUp(), FadeUpProps (+3 more)

### Community 63 - "next"
Cohesion: 0.06
Nodes (20): POST(), runtime, T, GET(), normalizeCachedStats(), calculateLeadScore(), GET(), PATCH() (+12 more)

### Community 64 - "product-service-profile.ts"
Cohesion: 0.30
Nodes (10): saveProductServiceProfile(), CapacityGroup, DEFAULT_PRODUCT_SERVICE_PROFILE, IncludedService, isRecord(), normalizeCapacityForStorage(), PaidAddon, parseJsonField() (+2 more)

### Community 65 - "zod"
Cohesion: 0.07
Nodes (21): patchSchema, POST(), createSchema, POST(), POST(), createSchema, POST(), createSchema (+13 more)

### Community 66 - "create/route.ts"
Cohesion: 0.16
Nodes (11): POST(), POST(), GET(), DemoPage(), DemoPageProps, PreviewSandbox(), PreviewSandboxProps, issueSignedPreviewToken() (+3 more)

### Community 67 - "accounts/[id]/route.ts"
Cohesion: 0.23
Nodes (10): DELETE(), PATCH(), patchSchema, prisma(), createSchema, permissionSchema, POST(), isSubadminAction() (+2 more)

### Community 68 - "service-discovery.ts"
Cohesion: 0.11
Nodes (28): admin(), DELETE(), jsonValue(), PATCH(), admin(), campaignSchema, collectionSchema, GET() (+20 more)

### Community 69 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, db:generate, db:migrate, db:migrate:prod, db:push, db:seed, db:studio (+10 more)

### Community 70 - "subadmin-workforce.ts"
Cohesion: 0.13
Nodes (27): loginSchema, POST(), PATCH(), reviewSchema, POST(), prisma(), GET(), applicationSchema (+19 more)

### Community 71 - "getPortalSetting"
Cohesion: 0.21
Nodes (11): prisma(), SubadminManagementPage(), GET(), prisma(), GET(), PATCH(), settingsSchema, GET() (+3 more)

### Community 72 - "PremiumServiceDetailClient.tsx"
Cohesion: 0.12
Nodes (14): AddonService, CYCLE_LABELS, fmt(), PremiumService, PremiumServiceDetailClient(), Product, ProductTier, QueryModal() (+6 more)

### Community 73 - "ServiceDiscoveryShelf.tsx"
Cohesion: 0.20
Nodes (13): metadata, Props, ServicesDirectoryPage(), AutoPlayingVideo(), BADGE_STYLES, BUTTON_CLASS_MAP, Discovery, POSITION_CLASS_MAP (+5 more)

### Community 74 - "ChatWindow.tsx"
Cohesion: 0.22
Nodes (9): ChatRoom, ChatWindow(), ChatWindowProps, Message, getPusherClient(), isPusherConfigured(), noopClient, pusherClient (+1 more)

### Community 75 - "openai.ts"
Cohesion: 0.23
Nodes (10): POST(), POST(), POST(), embeddingWorkerOptions, worker, generateEmbedding(), openai, streamChat() (+2 more)

### Community 76 - "custom-service-requests/[id]/route.ts"
Cohesion: 0.29
Nodes (8): AdminServiceRequestDetailPage(), dynamic, GET(), PATCH(), statusSchema, assertCustomServiceRequestAccess(), CUSTOM_SERVICE_STATUSES, emitCustomServiceRequest()

### Community 77 - "dashboard/index.tsx"
Cohesion: 0.15
Nodes (9): ActivityFeedProps, ActivityItem, AIUsageMeterProps, AnimatedValue(), BillingWidgetProps, QuickAction, StatItem, StatsWidget() (+1 more)

### Community 78 - "requireSuperAdmin"
Cohesion: 0.21
Nodes (13): POST(), POST(), POST(), GET(), POST(), createSchema, GET(), POST() (+5 more)

### Community 79 - "app/layout.tsx"
Cohesion: 0.27
Nodes (8): app_globals, metadata, RootLayout(), ClerkSessionSync(), Providers(), ThemeProvider(), ThemeProviderProps, CartProvider()

### Community 80 - "revenue/page.tsx"
Cohesion: 0.24
Nodes (10): CustomTooltip(), DaySale, RevenueChartClient(), TopUser, TopUsersTable(), getRevenueData(), KPICard(), metadata (+2 more)

### Community 81 - "content/route.ts"
Cohesion: 0.30
Nodes (11): baseSchema, DELETE(), entityLabel(), isAdmin(), mutateContent(), normalizeOptionalString(), parseJsonArray(), parseJsonObject() (+3 more)

### Community 82 - "dashboard/service-requests/page.tsx"
Cohesion: 0.47
Nodes (5): dynamic, MyServiceRequestsPage(), STATUS_META, StatusBadge(), timeAgo()

### Community 83 - "dashboard/SubscriptionsClient.tsx"
Cohesion: 0.17
Nodes (14): fmtDate(), fmtMoney(), Product, Props, STATUS_CONFIG, Subscription, SubscriptionsClient(), UpgradeButton() (+6 more)

### Community 84 - "services/[slug]/page.tsx"
Cohesion: 0.29
Nodes (7): ServiceDetailsPage(), getErrorMessage(), ServiceLeadForm(), getErrorMessage(), RequestType, ServiceRequestForm(), ServiceDiscoveryTracker()

### Community 85 - "CRMPipeline.tsx"
Cohesion: 0.13
Nodes (11): AdminReviewsPage(), CRMPipelineProps, Lead, LeadActivity, stageColors, STAGES, ReviewModerationTable(), ReviewWithRelations (+3 more)

### Community 86 - "dialogs.tsx"
Cohesion: 0.17
Nodes (7): ALERT_STYLES, ConfirmDialogProps, InlineAlertProps, NOTIF_ICON, NOTIF_TYPE_STYLE, Notification, NotificationBellProps

### Community 87 - "db-credential-store.ts"
Cohesion: 0.08
Nodes (28): 10. Internal routing boundary, 11. Health / readiness, 13. Environment variables (all new, all gateway-scoped, none touching the main app's `lib/env.ts` schema), 14. Known limitations (explicit, not silently accepted), 15. Phase 2 prerequisites, 1. Deployment topology decision, 2. Trust boundary, 3. Entry point (+20 more)

### Community 88 - "emitEvent"
Cohesion: 0.11
Nodes (28): POST(), isAdmin(), POST(), PATCH(), POST(), POST(), campaignWorker, auditLog() (+20 more)

### Community 89 - "CountdownTimer"
Cohesion: 0.15
Nodes (15): getPricingData, metadata, PricingPage(), revalidate, INTERVAL_LABELS, PricingClient(), Product, Props (+7 more)

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
Cohesion: 0.28
Nodes (7): configSchema, GET(), PUT(), GET(), PATCH(), patchSchema, decryptConfig()

### Community 94 - "FeedbackClient.tsx"
Cohesion: 0.29
Nodes (7): FeedbackClient(), ProductItem, ReviewItem, FeedbackPage(), metadata, metadata, ReviewsPage()

### Community 95 - "admin/index.tsx"
Cohesion: 0.20
Nodes (7): ACTION_COLOR, AuditEntry, AuditLogTableProps, COLUMNS, Lead, LeadKanbanProps, PRIORITY_STYLE

### Community 96 - "api.ts"
Cohesion: 0.22
Nodes (9): API_ERROR_CODES, ApiErrorCode, ApiResponse, ListParams, PaginatedResponse, PartialBy, RequiredBy, Serialized (+1 more)

### Community 97 - "db.ts"
Cohesion: 0.08
Nodes (18): hashOtp(), POST(), GET(), POST(), IMPORTANT: Both buffers must use "hex" encoding so we compare the 32 raw bytes,, resolvePostPaymentRedirect(), verifySchema, verifySignature() (+10 more)

### Community 98 - "vitest"
Cohesion: 0.11
Nodes (17): ENCRYPTION_KEY, setupService(), ENCRYPTION_KEY, setupService(), ENCRYPTION_KEY, setupService(), createFakeDb(), FakeAgentConnectionRow (+9 more)

### Community 99 - "payments/index.tsx"
Cohesion: 0.22
Nodes (4): CheckoutFormProps, OrderSummaryProps, PaymentMethodCardProps, UpgradePromptProps

### Community 100 - "permissions.ts"
Cohesion: 0.14
Nodes (14): 3. Authorization Architecture (current), Admin vs. Team Member vs. Future Agent (illustrative, using existing enforcement only), Identity layers (current, human-facing), Phase 0 — Authorization Matrix, Resource ownership patterns (confirmed via code, not inferred), Role enum (source of truth), hasAllPermissions(), hasAnyPermission() (+6 more)

### Community 101 - "admin/emails/preview/route.ts"
Cohesion: 0.20
Nodes (11): POST(), schema, POST(), schema, ManualPaymentReviewAdminEmail(), buildSmtpTransport(), ManualPaymentReviewEmailParams, sendManualPaymentReviewEmail() (+3 more)

### Community 102 - "[category]/page.tsx"
Cohesion: 0.29
Nodes (4): CATEGORY_META, CategoryPage(), categoryToDbFilter(), Props

### Community 103 - "join-our-team/page.tsx"
Cohesion: 0.36
Nodes (4): Field(), JoinOurTeamClient(), Status, JoinOurTeamPage()

### Community 104 - "ProductDetailClient.tsx"
Cohesion: 0.20
Nodes (11): getActiveCampaignForProduct(), getProduct(), getRelated(), ProductDetailPage(), Props, INTERVAL_LABELS, Product, ProductDetailClient() (+3 more)

### Community 105 - "DemoTimer.tsx"
Cohesion: 0.25
Nodes (4): DemoNavProps, DemoTimerProps, RuntimeStatusProps, TEMPLATES

### Community 106 - "CartProvider.tsx"
Cohesion: 0.22
Nodes (10): PreviewSession, Product, AuthUser, useAuth(), CartData, CartItem, CartSyncState, useCartSync() (+2 more)

### Community 108 - "crm.ts"
Cohesion: 0.25
Nodes (7): CRM_STAGES, CRMStage, CRMStats, LEAD_SOURCES, LeadCard, LeadSource, LeadWithInteractions

### Community 109 - "AdminServiceCategoriesClient.tsx"
Cohesion: 0.48
Nodes (5): AdminServiceCategoriesClient(), Category, emptyForm(), AdminServiceCategoriesPage(), toIso()

### Community 110 - "requireServiceOperationsAccess"
Cohesion: 0.12
Nodes (19): AdminServiceAnalyticsPage(), formatMoney(), Metric(), AdminServiceEmailsPage(), AdminServiceLeadsClient(), AdminServiceLeadsPage(), toIso(), AdminServiceOrdersClient() (+11 more)

### Community 111 - "types.ts"
Cohesion: 0.13
Nodes (14): 12. Logging / observability, toExternalAuthErrorCode(), buildLimiters(), GatewayRedisRateLimiter, getLimiters(), auditHookSingleton, LoggingAuditHook, gatewayLogger (+6 more)

### Community 112 - "custom-service-portal/settings/route.ts"
Cohesion: 0.43
Nodes (6): admin(), GET(), PATCH(), schema, CUSTOM_SERVICE_PORTAL_ID, isCustomServiceAdmin()

### Community 113 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 114 - "lucide-react"
Cohesion: 0.07
Nodes (17): InvoicesPage(), metadata, STATS, TIMELINE, VALUES, JOBS, metadata, PERKS (+9 more)

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

### Community 125 - "GatewayError"
Cohesion: 0.17
Nodes (17): getGatewayConfig(), assertLegalTransition(), isLegalTransition(), LEGAL_TRANSITIONS, ALLOWED_CONTENT_TYPES, ALLOWED_METHODS, parseJsonBody(), validateBodySize() (+9 more)

### Community 126 - "stock/route.ts"
Cohesion: 0.40
Nodes (5): GET(), PATCH(), REVALIDATE_PROFILE, revalidateStockCaches(), StockAction

### Community 127 - "requireApiAuth"
Cohesion: 0.17
Nodes (17): abandonSchema, POST(), DELETE(), GET(), PATCH(), POST(), POST(), GET() (+9 more)

### Community 128 - "🛠️ Getting Started"
Cohesion: 0.11
Nodes (17): 1. Installation, 2. Environment Variables, 3. Database Migration & Setup, 4. Running the Development Server, 5. Running Background Workers, 📜 Available Scripts, Backend & Database, Frontend & UI (+9 more)

### Community 129 - "[id]/upgrades/route.ts"
Cohesion: 0.15
Nodes (10): GET(), POST(), requestSchema, GET(), POST(), upgradeSchema, markRenewalRequested(), REMINDER_WINDOWS_DAYS (+2 more)

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
Cohesion: 0.50
Nodes (4): BackgroundVideo(), fadeIn(), startFade(), hls.js

### Community 134 - "types/auth.ts"
Cohesion: 0.33
Nodes (5): SafeUser, SessionUser, UserListRow, UserProfile, UserWithSubscription

### Community 135 - "Phase 0 — Security Baseline"
Cohesion: 0.15
Nodes (12): Content Security Policy — gaps found, CORS, CSRF, Error handling / information leakage, HTTP / Transport, Phase 0 — Security Baseline, Rate limiting, Replay protection (+4 more)

### Community 136 - "encryption.ts"
Cohesion: 0.24
Nodes (5): Phase 0 — Data Sensitivity Matrix, Redaction principle for Phase 1+, decrypt(), verifyEncrypted(), resolveDeliveryMeta()

### Community 137 - "Phase 0 — Side-Effect Map"
Cohesion: 0.20
Nodes (9): admin.banUser, Cross-cutting observation, deployment-center.advanceStatus, Phase 0 — Side-Effect Map, products.update, products.updateTier (price change), refunds.process (processRefund), subscriptions.cancel (+1 more)

### Community 138 - "NeuralBackground.tsx"
Cohesion: 0.60
Nodes (3): AuthLayout(), NeuralBackground(), Point

### Community 139 - "chat/ChatClient.tsx"
Cohesion: 0.40
Nodes (3): AGENTS, Msg, STARTER_PROMPTS

### Community 140 - "MarketplaceClient.tsx"
Cohesion: 0.28
Nodes (7): AgentCardData, CATEGORIES, Props, SerializedProduct, SORT_OPTIONS, TYPES, ProductCardProps

### Community 141 - "ContactSalesClient.tsx"
Cohesion: 0.38
Nodes (4): ContactSalesClient(), TRUST_METRICS, ContactSalesPage(), metadata

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

### Community 147 - "Phase 0 — Dangerous Primitive Audit"
Cohesion: 0.22
Nodes (8): Arbitrary URL fetch / SSRF-shaped endpoints, eval / dynamic code execution, Generic object-mutation / CRUD endpoints — the one real finding, Phase 0 — Dangerous Primitive Audit, Raw SQL (`$executeRaw` / `$queryRaw` / `*Unsafe` variants), Service-role keys / admin DB credentials in code, Shell / child process execution, Summary verdict

### Community 150 - "CallToAction"
Cohesion: 0.10
Nodes (23): metadata, ApiReferencePage(), metadata, ComparePage(), metadata, Props, DEMOS, LiveDemosPage() (+15 more)

### Community 151 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 152 - "health.ts"
Cohesion: 0.39
Nodes (6): GET(), runtime, checkBackend(), checkRedis(), GatewayHealthPayload, getGatewayHealth()

### Community 155 - "featureFlags.ts"
Cohesion: 0.83
Nodes (3): getFeatureFlags(), getUserBucket(), isFeatureEnabled()

### Community 156 - "firebase-client.ts"
Cohesion: 0.50
Nodes (3): firebaseConfig, IMPORTANT: This module is completely independent of Clerk., firebase

### Community 157 - "sanitize-product.ts"
Cohesion: 0.67
Nodes (3): sanitizeProductForPublic(), sanitizeProductsForPublic(), SENSITIVE_PRODUCT_FIELDS

### Community 163 - "Phase 0 — AI Exposure Candidate Matrix"
Cohesion: 0.25
Nodes (7): AI_APPROVAL_REQUIRED_CANDIDATE (HIGH_RISK_MUTATION — human sign-off required, never autopilot), AI_BLOCKED (permanent — not a phase-in-time restriction, an architectural exclusion), AI_LOW_RISK_CANDIDATE (reversible, low blast radius — good Phase 1 pilot capabilities), AI_READ_CANDIDATE (safe to expose first, once resource-scoped), Confirmed non-existent (do not plan Phase 1+ tools around these), One-line rationale summary (why these tiers, not others), Phase 0 — AI Exposure Candidate Matrix

### Community 177 - "centers/[slug]/page.tsx"
Cohesion: 0.52
Nodes (6): formatCount(), Metric(), Panel(), ServiceCenterDetailPage(), StatCard(), toIso()

### Community 183 - "coupons/route.ts"
Cohesion: 0.38
Nodes (6): bulkGenerateSchema, createCouponSchema, GET(), isAdmin(), paginationSchema, POST()

### Community 184 - "Phase 0 — Event / Queue / Worker / Cache-Reflection Map"
Cohesion: 0.29
Nodes (6): Cron / recurring jobs (BullMQ repeatable, all require a persistent worker process), Domain events (`lib/services/event-bus.ts`, `EVENTS` constant, ~46 names), ISR / cache revalidation (`lib/revalidate.ts`), Phase 0 — Event / Queue / Worker / Cache-Reflection Map, UI reflection mechanisms (confirmed, all three), Webhook endpoints (inbound — never agent-invoked capabilities, but relevant to gateway threat modeling)

### Community 185 - "Phase 0 — Phase 1 Readiness Report"
Cohesion: 0.29
Nodes (6): Answers to the 20 Future Agent Gateway Readiness Questions, Blockers (things Phase 0 could not fully resolve within a read-only audit), Phase 0 — Phase 1 Readiness Report, Phase 1 Prerequisites (what Phase 1 will need — described, not built, per Section 34), Readiness checklist (per audit Section 36/37), Recommended Phase 1 Inputs (summary, cross-referencing all Phase 0 artifacts)

### Community 186 - "Phase 0 — Risk Matrix"
Cohesion: 0.29
Nodes (6): CRITICAL — trust-boundary, financial-settlement, or privilege operations. Never generic agent tools; never autopilot., Cross-cutting risk note: idempotency and risk tier are independent, HIGH_RISK_MUTATION — customer/financial/production impact, reversible with effort, LOW_RISK_WRITE — reversible, low external impact, Phase 0 — Risk Matrix, READ — no state mutation, default AI-autonomous candidate once auth-scoped

### Community 187 - "vendor/page.tsx"
Cohesion: 0.53
Nodes (3): currency(), VendorStudioPage(), VendorOnboardingClient()

### Community 188 - "marketplace/ActivityFeed.tsx"
Cohesion: 0.33
Nodes (5): ActivityFeed(), ActivityItem, ICONS, Props, SEED_ITEMS

### Community 189 - "Phase 0 — Service Dependency Map"
Cohesion: 0.33
Nodes (5): Event/cache dependency graph, Layered dependency graph (human path, confirmed by code), Phase 0 — Service Dependency Map, Queue/worker dependency graph, Which layer can the future Agent Gateway safely call?

### Community 190 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 191 - "ecosystem/page.tsx"
Cohesion: 0.70
Nodes (4): Card(), EcosystemControlPage(), money(), getEnterpriseCommandCenter()

### Community 193 - "sentry-example-api/route.ts"
Cohesion: 0.50
Nodes (3): dynamic, GET(), SentryExampleAPIError

### Community 195 - "Phase 0 — Bug / Defect Baseline"
Cohesion: 0.40
Nodes (4): Explicit non-bugs (confirmed correct, listed to avoid false suspicion in later phases), Lint/config hygiene findings (BUG-15 through BUG-18) — none security-relevant, all DOCUMENT_ONLY, Live test/build baseline (run during this audit), Phase 0 — Bug / Defect Baseline

### Community 196 - "POST"
Cohesion: 0.67
Nodes (3): POST(), adminAuth, firebase-admin

### Community 197 - "my-products/page.tsx"
Cohesion: 0.67
Nodes (3): metadata, MyProductsPage(), normalizeProductServiceProfile()

### Community 198 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 199 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 200 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

## Knowledge Gaps
- **1143 isolated node(s):** `Usage`, `What graphify is for`, `Step 0 - GitHub repos and multi-path merge (only if a URL or several paths)`, `Step 1 - Ensure graphify is installed`, `Step 2 - Detect files` (+1138 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1395 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `auth`, `lib/auth.ts`, `requireAdmin`, `Button`, `auditLog`, `PageHero`, `DashboardLayoutClient.tsx`, `env`, `Badge`, `cn`, `enterprise-commerce-service.ts`, `package.json`, `AdminProductsClient.tsx`, `otp.ts`, `admin-auth.ts`, `service-lifecycle-service.ts`, `Input`, `useToast`, `MyProductsClient.tsx`, `createNotification`, `WebhooksClient.tsx`, `ProductCard.tsx`, `ServiceCampaignCenterClient.tsx`, `CustomServiceRequestForm.tsx`, `CouponsClient.tsx`, `subscription-service.ts`, `cache-service.ts`, `notifications.ts`, `subadmin-permission-policy.ts`, `(public)/page.tsx`, `@sentry/nextjs`, `CheckoutClient.tsx`, `CustomServiceDiscussionClient.tsx`, `sendEmail`, `invoice-pdf.ts`, `serializePrisma`, `AdminUsersClient.tsx`, `Navbar.tsx`, `PaymentsInspectionClient.tsx`, `AdminServiceEditClient.tsx`, `clerk-user-sync.ts`, `custom-service-portal.ts`, `@clerk/nextjs`, `refund-service.ts`, `(public)/layout.tsx`, `service.ts`, `marketplace/page.tsx`, `product-service-profile.ts`, `zod`, `create/route.ts`, `accounts/[id]/route.ts`, `service-discovery.ts`, `subadmin-workforce.ts`, `getPortalSetting`, `PremiumServiceDetailClient.tsx`, `ServiceDiscoveryShelf.tsx`, `openai.ts`, `custom-service-requests/[id]/route.ts`, `requireSuperAdmin`, `app/layout.tsx`, `revenue/page.tsx`, `content/route.ts`, `dashboard/service-requests/page.tsx`, `dashboard/SubscriptionsClient.tsx`, `services/[slug]/page.tsx`, `emitEvent`, `CountdownTimer`, `marketplace/index.tsx`, `admin/service-requests/page.tsx`, `config/route.ts`, `FeedbackClient.tsx`, `db.ts`, `payments/index.tsx`, `admin/emails/preview/route.ts`, `[category]/page.tsx`, `ProductDetailClient.tsx`, `CartProvider.tsx`, `revalidate.ts`, `AdminServiceCategoriesClient.tsx`, `requireServiceOperationsAccess`, `custom-service-portal/settings/route.ts`, `lucide-react`, `[id]/TicketDetailClient.tsx`, `(public)/ai-agents/page.tsx`, `ai-agents/[slug]/page.tsx`, `blog/page.tsx`, `developers/page.tsx`, `marketing/index.tsx`, `subscription-guard.ts`, `stock/route.ts`, `requireApiAuth`, `[id]/upgrades/route.ts`, `blog/[slug]/page.tsx`, `MarketplaceClient.tsx`, `ContactSalesClient.tsx`, `RazorpayButton.tsx`, `projects/ProjectsClient.tsx`, `tickets/TicketsClient.tsx`, `CallToAction`, `health.ts`, `dashboard/subscriptions/SubscriptionsClient.tsx`, `press/page.tsx`, `cookies/page.tsx`, `unauthorized/page.tsx`, `HeroSection.tsx`, `PricingCards.tsx`, `CheckoutButton.tsx`, `centers/[slug]/page.tsx`, `coupons/route.ts`, `vendor/page.tsx`, `ecosystem/page.tsx`, `redis.ts`, `admin-access/page.tsx`, `my-products/page.tsx`, `ResetPasswordClient.tsx`?**
  _High betweenness centrality (0.252) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `Button`, `PageHero`, `DashboardLayoutClient.tsx`, `Badge`, `cn`, `package.json`, `AdminProductsClient.tsx`, `Input`, `useToast`, `MyProductsClient.tsx`, `WebhooksClient.tsx`, `ServiceCampaignCenterClient.tsx`, `BillingCenterClient.tsx`, `CustomServiceRequestForm.tsx`, `CouponsClient.tsx`, `workers.ts`, `shared/index.tsx`, `(public)/page.tsx`, `AdminAuditClient.tsx`, `@sentry/nextjs`, `CheckoutClient.tsx`, `CustomServiceDiscussionClient.tsx`, `sendEmail`, `SubadminManagementClient`, `serializePrisma`, `AdminUsersClient.tsx`, `Navbar.tsx`, `PaymentsInspectionClient.tsx`, `AdminServiceEditClient.tsx`, `clerk-user-sync.ts`, `@clerk/nextjs`, `(public)/layout.tsx`, `service.ts`, `PremiumServicesClient.tsx`, `marketplace/page.tsx`, `next`, `create/route.ts`, `subadmin-workforce.ts`, `PremiumServiceDetailClient.tsx`, `ServiceDiscoveryShelf.tsx`, `ChatWindow.tsx`, `dashboard/index.tsx`, `app/layout.tsx`, `dashboard/SubscriptionsClient.tsx`, `services/[slug]/page.tsx`, `CRMPipeline.tsx`, `dialogs.tsx`, `CountdownTimer`, `marketplace/index.tsx`, `admin/service-requests/page.tsx`, `FeedbackClient.tsx`, `admin/index.tsx`, `payments/index.tsx`, `join-our-team/page.tsx`, `ProductDetailClient.tsx`, `DemoTimer.tsx`, `CartProvider.tsx`, `AdminServiceCategoriesClient.tsx`, `requireServiceOperationsAccess`, `lucide-react`, `[id]/TicketDetailClient.tsx`, `ProductSearch.tsx`, `RichTextEditor.tsx`, `BackgroundVideo`, `NeuralBackground.tsx`, `chat/ChatClient.tsx`, `MarketplaceClient.tsx`, `ContactSalesClient.tsx`, `UserTable.tsx`, `RazorpayButton.tsx`, `useFileUpload.ts`, `projects/ProjectsClient.tsx`, `tickets/TicketsClient.tsx`, `CallToAction`, `CRMTemplate.tsx`, `useSubscription.ts`, `invoices/InvoicesClient.tsx`, `dashboard/subscriptions/SubscriptionsClient.tsx`, `press/page.tsx`, `cookies/page.tsx`, `PreviewConfigForm.tsx`, `PreviewModal.tsx`, `CouponField.tsx`, `centers/[slug]/page.tsx`, `vendor/page.tsx`, `marketplace/ActivityFeed.tsx`, `admin-access/page.tsx`, `ResetPasswordClient.tsx`?**
  _High betweenness centrality (0.218) - this node is a cross-community bridge._
- **Why does `db` connect `auth` to `lib/auth.ts`, `requireAdmin`, `[id]/upgrades/route.ts`, `blog/[slug]/page.tsx`, `env.ts`, `auditLog`, `env`, `Badge`, `enterprise-commerce-service.ts`, `AdminProductsClient.tsx`, `otp.ts`, `admin-auth.ts`, `service-lifecycle-service.ts`, `Input`, `useToast`, `createNotification`, `WebhooksClient.tsx`, `CallToAction`, `health.ts`, `BillingCenterClient.tsx`, `featureFlags.ts`, `CouponsClient.tsx`, `subscription-service.ts`, `workers.ts`, `cache-service.ts`, `connection-service.ts`, `notifications.ts`, `(public)/page.tsx`, `AdminAuditClient.tsx`, `CheckoutClient.tsx`, `sendEmail`, `invoice-pdf.ts`, `serializePrisma`, `centers/[slug]/page.tsx`, `PaymentsInspectionClient.tsx`, `clerk-user-sync.ts`, `custom-service-portal.ts`, `coupons/route.ts`, `refund-service.ts`, `vendor/page.tsx`, `service.ts`, `(public)/layout.tsx`, `marketplace/page.tsx`, `next`, `product-service-profile.ts`, `zod`, `create/route.ts`, `accounts/[id]/route.ts`, `service-discovery.ts`, `my-products/page.tsx`, `subadmin-workforce.ts`, `getPortalSetting`, `ServiceDiscoveryShelf.tsx`, `openai.ts`, `custom-service-requests/[id]/route.ts`, `requireSuperAdmin`, `content/route.ts`, `dashboard/service-requests/page.tsx`, `services/[slug]/page.tsx`, `CRMPipeline.tsx`, `emitEvent`, `CountdownTimer`, `admin/service-requests/page.tsx`, `config/route.ts`, `db.ts`, `[category]/page.tsx`, `ProductDetailClient.tsx`, `AdminServiceCategoriesClient.tsx`, `requireServiceOperationsAccess`, `custom-service-portal/settings/route.ts`, `(public)/ai-agents/page.tsx`, `ai-agents/[slug]/page.tsx`, `blog/page.tsx`, `subscription-guard.ts`, `stock/route.ts`, `requireApiAuth`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `auth()` (e.g. with `Auth helper functions (exact call chains)` and `Identity layers (current, human-facing)`) actually correct?**
  _`auth()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `requireAdmin()` (e.g. with `3. Authorization Architecture (current)` and `5. Known Architectural Inconsistencies (documented, not fixed — see BUG-BASELINE.md)`) actually correct?**
  _`requireAdmin()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Usage`, `What graphify is for`, `Step 0 - GitHub repos and multi-path merge (only if a URL or several paths)` to the rest of the system?**
  _1143 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `auth` be split into smaller, more focused modules?**
  _Cohesion score 0.031476997578692496 - nodes in this community are weakly interconnected._