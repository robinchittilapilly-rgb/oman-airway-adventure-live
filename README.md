# Oman Airway Adventure

help me create a highly professional airline internet booking engine. Here are the overall functional requirements in this area. You can focus on the requirements and the workflows pertaining to the internet booking engine. The website should look highly professional, modern and should appeal to the Gen Alpha, Gen Z and the Middle Eastern community in particular. This is for Oman Air. So you can pick up some of the logo and ui aesthics from www.omanair.com. Functional requirements: "Front-End Channels (Decoupled UI/UX)
	Design and develop Native Mobile App & Website for (Shopping and Booking, Servicing, Check-in, & FFP) Front-End:
FR-1	(Native Performance): The Bidder must design and develop high-performance Native Mobile Apps (Swift for iOS and Kotlin for Android) and a Responsive Web IBE. Hybrid or "web-view" wrappers are prohibited for core transactional flows
FR-2	(Omnichannel State): The Bidder must ensure the UI maintains a shared state via the BFF, allowing for cart persistence across desktop and mobile app sessions.
FR-3	(Complex Pax Rules): The Bidder must deliver a solution that supports complex passenger rules configurable by the airline (e.g., max 12 passengers, specific adult/child/infant ratios).
FR-4	(Seat Map Visualization): The Bidder must build a UI that dynamically displays Seat Maps for different aircraft types, with clear visual distinctions for free, paid, legroom, and exit seats.
FR-5	(Self-Service IRROPS): The Bidder must provide comprehensive self-service disruption management capabilities within the UI, handling schedule changes, cancellations, and fee waivers.
FR-6	(Accessibility): The Bidder must ensure the Front-End UI achieves WCAG 2.2 AAA compliance for global accessibility standards.
FR-7	(Conversational AI): The Bidder must integrate a GenAI-powered conversational interface into the UI, capable of executing multi-step booking changes via the BFF.
FR-8	(Native Wallet Integration): The Bidder must integrate native OS capabilities, specifically Apple Wallet and Google Wallet, for seamless boarding pass storage and retrieval.
FR-9	(Secure Offline Caching): The Bidder must ensure the Native Mobile App supports secure offline caching so users can access retrieved Boarding Passes and upcoming itinerary details without an internet connection.
FR-10	(Deep Linking): The Bidder must implement Universal Links (iOS) and App Links (Android) to route users seamlessly from external CRM emails or SMS directly into specific authenticated app states. (e.g., straight to "Manage My Booking" or "Check-in").
FR-11	(Language & RTL): The Bidder must natively support multi-language interfaces, including flawless Right-to-Left (RTL) rendering for Arabic, without causing layout breakage.
FR-12	(Design System): The Bidder must build, document, and hand over a centralized, version-controlled UI Design System (e.g., via Figma) to ensure component consistency across both Web and Native platforms.
FR-13	(Analytics Instrumentation): The Bidder must instrument the Front-End architecture to natively support enterprise Tag Management Systems (e.g., Google Tag Manager, Insider) for tracking e-commerce conversions and user behavior.
FR-14	(Scan Doc): The Bidder must implement a native document scanning module using device camera capabilities and advanced Optical Character Recognition (OCR). This module must not be limited to MRZ (Machine Readable Zone) lines but must provide a full-scale "Scan-to-Form" experience:
FR-15	(Location Services): Bidder must integrate location services (GPS) to enable contextual "Day of Travel" UI changes (e.g., automatically surfacing the boarding pass on the home screen when the user is within a defined radius of the departure airport).
FR-16	(Rich Notifications): Bidder must implement Rich Push Notifications (APNs/FCM) supporting images, deep links, and actionable buttons.
FR-17	(Feature Flagging): Bidder must support feature flagging and A/B testing (e.g., Firebase, Optimizely) without requiring hardcoded app updates.
	Design and develop Frequent Flyer Member Portal
FR-18	(Loyalty Dashboard): Bidder must implement a personalized dashboard displaying real-time tier status, reward miles, tier miles, and a visual progress tracker for tier retention and promotion.
FR-19	(Enrollment Flow): Bidder must deliver a seamless enrollment and onboarding flow, supporting social media login and automated profile creation.
FR-20	(Retro-Claiming): Bidder must provide a self-service "Claim Missing Miles" (Retro-claim) module with automated PNR validation via the backend Loyalty Management System (LMS).
FR-21	(Household Management): Bidder must build a Family/Household Management interface, allowing designated primary members to link accounts, pool miles, and manage travel beneficiaries according to airline business rules.
FR-22	(Redemption Catalog): Bidder must build a non-flight redemption catalog UI, enabling members to spend miles on external partners (e.g., duty-free, hotels, car rentals) directly from their portal.
FR-23	(SSO Token Management): Bidder must ensure seamless Single Sign-On (SSO) token management, allowing persistent authenticated sessions when users navigate between the FFP Portal, Web IBE, and Mobile App without re-authenticating.
FR-24	(CRM/LMS Interface): Bidder must build the FFP frontend to securely interface with the airline's underlying CRM and LMS via the centralized BFF, ensuring no direct UI-to-database connections.
	Design and develop Website Portal
FR-25	(Home Page): Bidder must develop a responsive, SEO-optimized Informational Website fully driven by the Headless CMS, ensuring no hardcoded text or media.
FR-26	(Flight Search Widget): Bidder must implement a global "Flight Search Widget" on the portal homepage that captures origin, destination, dates, and passengers, securely passing this payload to the decoupled Web IBE to initiate the shopping flow.
FR-27	(Destination Guides): Bidder must build a dynamic Destination Guide and Route Map infrastructure, supporting rich media and contextual promotional offers tagged by location.
FR-28	(Flight Status): Bidder must integrate a real-time Flight Status and Timetable module, pulling read-only schedule data via the BFF without exposing core PSS transactional APIs.
FR-29	(Enterprise Search): Bidder must provide site-wide enterprise search capabilities, allowing users to instantly find corporate policies, baggage rules, and travel advisories through indexed CMS content.
FR-30	(Geo-Routing): Bidder must ensure the portal utilizes geo-location and browser language sniffing to automatically route users to their correct regional site (e.g., Oman vs. Europe) and preferred language upon their first visit.
FR-31	(Dark Site): Bidder must design and develop an ultra-lightweight, high-availability 'Dark Site' Front-End template that automatically strips out heavy media, promotional APIs, and non-essential scripts to handle extreme traffic spikes.
FR-32	(Dark Site): Bidder must ensure the Dark Site UI prominently features emergency contact directories, real-time press release feeds, and a simplified "Check Flight Status" module that queries the BFF without hitting the core transactional PSS.
	Content & Orchestration (Middleware)
	Headless CMS Implementation (To feed content to the Web Portal, Web IBE, and Mobile App):
FR-33	Bidder must implement an API-first Headless CMS architecture to serve content natively and concurrently to the Web Portal, Web IBE, and Native Mobile App.
FR-34	Bidder must configure the CMS to support dynamic content contextualization, automatically tailoring promotional banners and text based on user state (e.g., upcoming flight destination, logged-in FFP tier, or geo-location).
FR-35	Bidder must provide a role-based Admin Panel that grants internal teams full control over multi-language text (including flawless Right-to-Left Arabic support) and media assets without requiring code deployments.
FR-36	Bidder must ensure the CMS supports a fully functional, pre-configured 'Dark Site' mode for immediate, one-click deployment during major operational disruptions or aviation emergencies.
FR-37	Bidder must seamlessly integrate the CMS with an enterprise-grade Content Delivery Network (CDN) to guarantee low-latency asset and media loading globally.
FR-38	Bidder must implement comprehensive content governance features, including version control, scheduled publishing workflows, and automated rollback capabilities.
	Experience API & Orchestration Layer (BFF with Business Logic)
FR-39	(PSS Agnostic): Bidder must implement a highly decoupled Backend-for-Frontend (BFF) utilizing an abstraction layer, ensuring the UI requires zero code changes during any future core PSS migrations.
FR-40	(Session & State Management): Bidder must design the BFF to maintain a unified "Shopping Cart" state across sessions, allowing a user to start a booking on Web and finish it on the Mobile App without losing selected flights or ancillaries.
FR-41	(API Aggregation): Bidder must ensure the BFF can aggregate multiple data sources (e.g., Sabre flight data + CMS images + 3rd party Insurance) into a single JSON response for the UI to improve performance.
FR-42	(Performance Caching): Bidder must implement within the BFF an intelligent caching layer (e.g., Redis) to store frequently accessed data like flight availability or fare families, ensuring sub-second response times for the front-end.
FR-43	(Protocol Translation): Bidder must ensure the BFF translates complex legacy PSS protocols (SOAP/XML) into modern, lightweight REST/JSON or GraphQL formats for the mobile and web channels.
FR-44	(Business Logic Decoupling): Critical: All retailing logic (e.g., "If passenger is Gold, hide seat fee") must reside in the BFF, not the UI. This ensures Oman Air can change business rules once in the BFF and have them apply to all channels instantly.
FR-45	(Security & Token Handling): Bidder must design the BFF to act as the secure gateway, managing OAuth2/OpenID Connect tokens for Sinbad members and masking sensitive PSS session IDs from the public internet.
FR-46	(Error Handling & Transformation): Bidder must ensure the BFF intercepts technical error codes from the PSS and transform them into user-friendly, localized messages (e.g., instead of "ERR_404_INV_CLASS," show "This seat is no longer available").
FR-47	(A/B Testing Support): Bidder must ensure the BFF supports "Traffic Splitting," allowing Oman Air to serve different retail offers or UI configurations to specific percentages of users to test conversion.
FR-48	(Rate Limiting & Throttling): Logic to protect the backend Sabre APIs by limiting the number of search requests per user session, preventing "Scraper" bots from driving up PSS costs.
FR-49	(Cross-Channel Continuity): Bidder must ensure the BFF supports "Handoff" tokens. If a user starts a check-in on a laptop, they should be able to scan a QR code to resume and finish the document upload (APIS) on their mobile phone instantly.
FR-50	(Biometric Integration Hooks): Future-Proof for STJ: Bidder must ensure the BFF provides endpoints for biometric enrollment data to be securely passed from the App to the Airport’s Identity Management system.
FR-51	(Mocking Framework): Bidder must provide a "Mocking" capability in the BFF, allowing UI developers to build and test front-end features even when the Sabre test environment is offline.
FR-52	(Centralized 3rd Party Integration): Bidder must establish this layer as the sole integration hub for all 3rd-party service providers (e.g., insurance, payment gateways, ground transport), shielding the Front-End from external vendor APIs.
	Design and Develop Retailing Capabilities (BFF Business Logic & UI)
	Note: The following requirements describe the business logic, orchestration rules, and UI components that the Bidder must develop within the BFF/Experience API layer to enable airline retailing. These are NOT requirements for a standalone product purchase.
	Shopping capabilities 
FR-53	(One-Way & Round-Trip): Bidder must develop the engine to support standard point-to-point searches with flexible date options.
FR-54	(Multi-City/Open-Jaw): Support for complex itineraries involving multiple destinations and non-contiguous flight segments.
FR-55	(Nearby Airports & City Codes): Bidder must develop the engine to support "Nearby Airport" search radius logic and resolve multi-airport city codes (e.g., searching "LON" must return results for LHR, LGW, STN, etc.).
FR-56	(Advanced Search Filters): Ability to filter/sort by price, duration, stops, and airline.
FR-57	(Flexible Date Search): A "Low Fare Calendar" view showing the cheapest prices across a range of dates (e.g., +/- 3 days or a monthly view).
FR-58	(Multi-Passenger Support): Bidder must support diverse passenger types (Adult, Child, Infant, Student, Senior, Labor) with automated age-validation logic.
FR-59	(Promo Code Integration): Bidder must handle "Promo Code" validation at the search stage, applying discounts to the results in real-time.
FR-60	(Multi-Currency Display): Real-time currency conversion based on the user's preferred currency or geo-location.
FR-61	(Cabin Class Selection): Support for searching across all available cabins (Economy, Business, First) with clear upselling indicators.
FR-62	(Branded Fares/Fare Families): Display fare attributes (e.g., "Economy Lite" vs. "Economy Flex") with associated benefits.
FR-63	(Real-Time Availability): Direct synchronization with the PSS to ensure that the seat inventory shown is live and "bookable.
FR-64	(Interline & Codeshare): Clear logic for displaying flights operated by partner airlines, including baggage rule disclosures.
FR-65	(Recent Search History): Bidder must develop the engine to store and retrieve the user’s recent searches to facilitate quick re-entry into the funnel.
FR-66	(Waitlist Search): Support for displaying waitlist availability if integrated with the PSS logic for specific fare classes.
FR-67	(Sold Out & Error State Handling): Bidder must implement logic for "Sold Out" or "No Flights" states. Instead of a dead-end error, the BFF must suggest alternative dates with availability or alternative nearby routes to keep the user in the booking funnel.
FR-68	(Fare Cache for Performance): Bidder must integrate the shopping flow with a Fare Cache (e.g., Redis or a dedicated NoSQL layer). This must store common search results to ensure sub-second response times for the UI and reduce unnecessary transaction costs on the PSS.
	Booking Capabilities
FR-69	(Passenger Data Validation): Bidder must develop the engine to capture and validate passenger details (First/Last Name, DOB, Gender) against ICAO standards before transmitting to the PSS to prevent record rejection.
FR-70	(Travel Document Capture - APIS): Bidder must implement logic to collect Advanced Passenger Information System (APIS) data, including Passports, Visas, and National IDs, dynamically required based on the destination.
FR-71	(SSR Catalog Orchestration): Bidder must develop the engine to fetch and display a real-time catalog of Special Service Requests (e.g., Wheelchairs, Bassinets, Oxygen) with the ability to show real-time confirmation status.
FR-72	(Meal Management): Integration of a dynamic meal selection engine that displays specific catering options based on the passenger's cabin class and flight duration.
FR-73	(Interactive Seat Selection): Bidder must develop the engine to support 2D/3D interactive seat maps fetched from the PSS, with logic to distinguish between free, paid, and "blocked" seats (for FFP tiers).
FR-74	(Hold My Fare / Fare Guarantee): Bidder must implement a "Time-to-Think" module, allowing the engine to hold the PNR and guaranteed price for a configurable period (e.g., 24/48 hours) for a fee.
FR-75	(PNR Creation & Commit): Bidder must develop the engine to orchestrate the "End Transaction" (EOT) process with the PSS and return a unique 6-character Record Locator (RLOC) to the user immediately.
FR-76	(Emergency Contact Management): Logic to capture optional or mandatory emergency contact data for specific international route compliance.
FR-77	(Profile & FFP Synchronization): For logged-in users, Bidder must ensure the booking engine automatically sync and pre-populate all stored passenger data from the Sinbad FFP profile via the BFF.
FR-78	(Saved Travelers / Companions): Bidder must ensure the Booking Engine supports "Saved Travelers" lists. For logged-in users, the system must allow the selection of previously saved travel companions from their profile, automatically populating their full legal names, DOBs, and passport details into the current booking.
FR-79	(Booking Context Persistence): Bidder must design the BFF to maintain the state of the booking "cart" so that if a user switches from Web to App during the flow, their selected flights and passenger data remain intact.
FR-80	(Booking Review & Validation Page): Bidder must implement a comprehensive "Review Page" logic. This layer must aggregate and display a final summary of all flight segments, passenger details, selected ancillaries, and a full price breakdown (Base Fare + Taxes + Fees) for user confirmation before the payment gateway is triggered.
	Dynamic Merchandising & Personalizations
FR-81	(Ancillary Service Catalog): Bidder must develop the engine to fetch and display the full catalog of airline-direct services (Extra Baggage, Lounge Access, Priority Boarding, Fast Track) as defined in the PSS.
FR-82	(Visual Seat Merchandising): Bidder must implement rich graphical seat maps (2D/3D) with the ability to display seat attributes (extra legroom, exit row, restricted view) and dynamic pricing based on seat characteristics.
FR-83	(Branded Fares): Bidder must build a "Branded Fares" comparison engine, highlighting differences in baggage, seat selection, and refundability between fare families.
FR-84	(Dynamic Bundling Logic): Bidder must develop the engine (via the BFF) to be able to create "Virtual Bundles"—combining a flight with specific ancillaries (e.g., Flight + Bag + Meal) as a single retail offer, even if they are stored as separate items in the PSS.
FR-85	(Ancillary Upsell Rules): Bidder must implement a rules engine that triggers specific offers based on the passenger's itinerary (e.g., offering "Lounge Access" only for long-haul or connecting flights).
FR-86	(Tier-Based Pricing & Visibility): Logic to automatically adjust ancillary prices or visibility based on the passenger’s FFP tier (e.g., showing "Complimentary Extra Baggage" for Gold members while charging Blue members).
FR-87	(Paid Upgrades - Fixed/Bid): Bidder must develop the engine to support "Instant Upgrades" to a higher cabin class at a fixed price or integrate with a bidding system (e.g., Plusgrade) for cabin upgrades.
FR-88	(Ancillary "Cart" Persistence): Bidder must ensure the BFF manages an ancillary "shopping cart" state, allowing users to add/remove services across the booking and manage-booking flows without losing data.
FR-89	(Multimedia Content Mapping): Bidder must provide the ability to map rich media (images, icons, and marketing descriptions) from the CMS to specific ancillary codes to ensure a high-end retail look.
FR-90	(Baggage Calculator): A dynamic backend tool that calculates the total baggage allowance (included + purchased) based on fare rules, route, and passenger tier to display a clear "Total Allowance" to the user.
FR-91	(Cross-Sell Triggering): Logic to trigger ancillary offers at various touchpoints: during the initial booking, on the "Booking Confirmed" page, within "Manage My Booking," and during the "Check-in" flow.
	Payment Capabilities
FR-92	(Global Card Acceptance): Bidder must integrate with major international card schemes (Visa, Mastercard, AMEX, Diners, JCB) ensuring full compliance with PCI-DSS standards.
FR-93	(Local Payment Methods - LPM): Bidder must develop the engine to support regional payment preferences (e.g., OmanNet, Mada, KNET) based on the user’s Point of Sale (POS) to maximize local conversion.
FR-94	(Digital Wallets): Native integration for Apple Pay and Google Pay, specifically optimized for one-touch payment within the Mobile App and Mobile Web.
FR-95	(Multi-Currency Pricing - MCP): Bidder must implement logic that allows the passenger to pay in their preferred currency, with the engine handling real-time exchange rate conversions between the PSS base currency and the payment currency.
FR-96	(Fraud Prevention Integration): Bidder must ensure the engine securely interface with the airline’s fraud detection system (e.g., Accertify or CyberSource) to perform pre-authorization risk scoring.
FR-97	(3D Secure 2.0): Mandatory support for EMV 3-D Secure (3DS2) to meet global regulatory requirements and reduce the airline’s liability for fraudulent chargebacks.
FR-98	(Payment Splitting / Mixed Forms): Bidder must implement "Multi-Form of Payment" (mFOP), allowing a single transaction to be split between Miles + Cash or Voucher + Credit Card.
FR-99	(Installment Payments): Support for "Buy Now, Pay Later" (BNPL) providers (e.g., Tasheel, Tabby or Tamara) or bank-led EMI (Equated Monthly Installment) plans.
FR-100	(Saved Payment Methods): Bidder must support "Saved Cards" management (tokenization) to allow one-click payments for logged-in users.
FR-101	(Automated Refund Trigger): Bidder must ensure the payment engine be able to signal the PSS and the gateway for automated refund processing based on the eligibility rules defined in the Service Engine.
	Frequent Flyer & Redemption
FR-102	(Miles Calculator): Bidder must build a "Miles Calculator" within the flow to show how many miles a passenger will earn for a specific flight choice.
FR-103	(Award Booking): Bidder must support "Award Booking" flows, including "Tax & Surcharge" calculations that must be paid in cash even when miles are used.
FR-104	(Miles Upgrades): Bidder must implement "Miles Upgrades" logic, allowing users with existing tickets to upgrade cabin classes using their loyalty balance.
FR-105	(Profile Pre-population): Bidder must ensure that for logged-in members, the engine automatically fetches and pre-fills all personal details (Passport, Contact Info, Preferences) into the booking and check-in flows via the BFF.
FR-106	(Tier-Based Merchandising): Bidder must configure the engine to recognize a member's tier (e.g., Gold, Silver) and automatically apply tier-specific benefits, such as waived seat fees or extra baggage allowances, during the ancillary selection phase.
FR-107	(Ancillary Redemption): Bidder must enable the "Burn Miles" capability within the Manage My Booking and Check-in flows, allowing members to pay for ancillaries (seats, bags, lounge) using miles or a Miles+Cash combination.
FR-108	(Retro-Claim Trigger): Bidder must provide a "Claim Missing Miles" entry point within the MMB flow that validates the PNR against the Loyalty Management System (LMS).
FR-109	(Omnichannel FFP State): Bidder must ensure the member's loyalty context (tier, balance, and benefits) is maintained in the BFF across all sessions, ensuring a consistent experience between the Web IBE and Mobile App.
	Other Capabilities (Digital Ancillary & 3rd Party Integration)
FR-110	(Direct Ancillary Fetch): Bidder must configure the engine to call Sabre APIs to fetch and display the real-time list of allowed airline-direct ancillaries (e.g., bags, meals, lounges) for specific routes.
FR-111	(Indirect Ancillary APIs): Bidder must establish direct API connections to 3rd-party vendors (e.g., Travel Insurance, Car Rentals, Hotels) to fetch live offers and availability in-path.
FR-112	(Ancillary Content Mapping): Bidder must provide a mechanism within the CMS/BFF to map rich content (images, 3D seat maps, and marketing descriptions) to the ancillary codes returned by the PSS or 3rd parties.
FR-113	(Contextual Triggering): Bidder must ensure the engine can trigger specific ancillary offers based on the point of sale, passenger profile, or booking stage (e.g., showing "Lounge Access" only on the Confirmation or Check-in screens).
FR-114	(Forced Selection Logic): Bidder must support "Forced Selection" merchandising techniques, requiring a definitive user choice (e.g., "Yes/No" for Insurance) before proceeding in the flow.
FR-115	(Ancillary Cart Orchestration): Bidder must ensure the BFF manages the "Cart State" for all selected ancillaries, allowing for real-time updates, removals, and price recalculations before payment.
FR-116	(EMD Fulfillment): Bidder must ensure that for every priced airline ancillary selected, the system correctly triggers the issuance of an EMD (Electronic Miscellaneous Document) within the Sabre PNR.
FR-117	(Bundling Exceptions): Bidder must implement logic to handle "Ancillary Bundles," where selecting a bundle that includes a seat must automatically waive individual seat selection fees in the UI.
FR-118	(Travel Bank & Voucher Integration): Bidder must provide a secure interface to the airline's Travel Bank to allow passengers to use digital credits or vouchers as a form of payment for any ancillary product.
FR-119	(3rd Party SSO/Handoff): Bidder must support secure handoff (SSO) or deep-linking to 3rd-party partner portals for products not fulfilled directly within the IBE, ensuring the passenger's context is maintained.
FR-120	(Post-Purchase Servicing): Bidder must develop the engine to allow passengers to view their purchased 3rd party services (e.g., Hotel confirmation number) within the "Manage My Booking" (MMB) dashboard.
FR-121	(Dynamic Price Overlays): Logic to support "Markup" or "Discount" overlays on 3rd party pricing if Oman Air chooses to run specialized commercial promotions on partner products.
	Design and Develop Post-Booking Service Capabilities (BFF Business Logic & UI)
	Note: The following requirements describe the business logic and UI components that the Bidder must develop within the BFF/Experience API layer to enable post-booking self-service (modifications, refunds, ancillary additions). These are NOT requirements for a standalone product purchase.
FR-122	(PNR Retrieval Logic): Bidder must develop the engine to allow retrieval of bookings via multiple identifiers (RLOC + Last Name, Email + Password for logged-in users, or FFP number) with secure session validation.
FR-123	(Flight Exchanges): Bidder must implement a self-service flight exchange to allow users to change flight dates or routes, calculating fare differences, taxes, and change fees.
FR-124	(Voluntary Refunds): Bidder must implement a self-service refund module that calculates refundability based on ATPCO fare rules and processes the credit back to the original form of payment.
FR-125	(Ancillary Upsell): Bidder must enable a "Post-Ticketing Shop," allowing passengers to add bags, seats, and meals to an existing PNR and issuing the corresponding EMDs (Electronic Miscellaneous Documents).
FR-126	(PNR Servicing): Bidder must support updating non-transactional data, including FFP numbers, contact details, and APIS (Passport/Visa) information post-ticketing.
FR-127	(Special Request Status): Real-time display of SSR (Special Service Request) statuses, showing if a wheelchair, bassinet, or special meal has been "Confirmed" (HK) or is "Pending" (PN) by the airline.
FR-128	(Split PNR): Bidder must develop logic to split a multi-passenger PNR so that a single passenger can modify their itinerary without affecting the rest of the party.
FR-129	(Voucher Issuance): Bidder must support "Refund to Voucher" logic, allowing the airline to issue a digital travel credit instead of a cash refund, managed via the BFF/Experience API.
FR-130	(IRROPS Self-Service): Bidder must implement an Involuntary Disruption module. If a flight is cancelled or delayed (Schedule Change), the engine must allow the passenger to accept the new flight or choose an alternative for free.
	Design and Develop Check-in Capabilities (BFF Business Logic, DCS Integration & UI)
	Note: The following requirements describe the business logic, DCS integration, and UI components that the Bidder must develop within the BFF/Experience API layer to enable online check-in and boarding pass delivery. These are NOT requirements for a standalone product purchase.
FR-131	(DCS Synchronization): Bidder must develop the engine to provide a real-time, bi-directional interface with the Sabre DCS to manage passenger check-in status, seat assignments, and boarding sequences.
FR-132	(Identity & Document Validation): Bidder must implement compliance logic to validate Passport, Visa, and Resident Card data (APIS) against the destination’s entry requirements before issuing a boarding pass.
FR-133	(Multi-Channel Boarding Pass): Bidder must implement the system to generate IATA BCBP-compliant barcodes delivered via Apple Wallet, Google Wallet, PDF, and Email.
FR-134	(Group & Family Check-in): Logic to allow a single user to check in all passengers within a PNR (or across multiple linked PNRs) in one session.
FR-135	(Last-Minute Merchandising): Bidder must develop the engine to support "Check-in Upsells," offering cabin upgrades and extra baggage at DCS-specific price points.
FR-136	(Check-in Restrictions): Bidder must ensure the system is able to "Inhibit" (prevent) self-service check-in for specific SSRs (e.g., Unaccompanied Minors, passengers needing document verification at the counter) and provide clear instructions.
FR-137	(Digital Bag Tag Integration): Support for generating and sending digital bag tag signals for use with home-printed tags or airport electronic bag tag kiosks.
FR-138	(Auto-Check-in Trigger): Ability to configure an "Auto-Check-in" service for premium members or specific fare families, automatically processing the check-in and sending the boarding pass 24 hours before departure.
FR-139	(Off-load Logic): Bidder must implement a secure "Undo Check-in" (Off-load) feature, allowing passengers to cancel their check-in status via the app or web if they can no longer travel.
FR-140	(Gate & Terminal Logic): Bidder must develop the engine to fetch and display real-time gate numbers, terminal information, and boarding times, refreshing the Digital Boarding Pass dynamically via push notifications.
FR-141	(Check-in Merchandising): Bidder must support "Last Minute Upgrades" and "Extra Baggage" purchases within the check-in flow at DCS-specific price points.
FR-142	(Boarding Pass Generation): Bidder must generate IATA BCBP-compliant 2D barcodes and deliver them in multiple formats: Apple Wallet, Google Wallet, PDF, and Email.
FR-143	(Check-in Restrictions): Bidder must implement business logic to "Inhibit" check-in for specific SSRs (e.g., Unaccompanied Minors, Passengers needing Visa checks) and redirect them to airport counters.
FR-144	(Bag Tag Integration): Bidder must ensure the engine can generate a Bag Tag signal (for Home Printed Bag Tags or Kiosk printing) integrated with the airline’s baggage rules.
FR-145	(Disruption-Aware Entry): Bidder must ensure the Check-in Engine detect disrupted flight statuses (CXL, DEL, SCH) via the DCS/PSS and automatically redirect the passenger to the Involuntary Re-accommodation flow without requiring them to log out and go to MMB.
FR-146	(Dynamic Re-protection Display): Bidder must implement logic to show "Alternative Flight Options" within the Check-in UI when a flight is cancelled, allowing for one-click acceptance and instant check-in for the new segment.
FR-147	(Voucher Trigger at Check-in): If no suitable flights are available during a check-in disruption, the engine must trigger the Service Engine logic to offer an immediate digital "Refreshment" or "Hotel" voucher delivered directly to the Mobile App/Email.
FR-148	(Biometric Enrollment Integration): Bidder must implement a "Biometric Opt-in" module within the Mobile App check-in flow. This must allow passengers to securely capture a live "Selfie" and consent to sharing their biometric template with Airport Biometric Identity Management System (BIMS).". I would need a fully working website, You can fetch data for the 20 routes omanair operates and get the prices for the last 30 days for each fare brand and use this in a local repository to be used for search results. We need to also support the sale of ancillary services as well as bundles. Go ahead and prepare a fully functional website for me

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/88afb5da-26c8-5ceb-8f50-0f1ada51238a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
