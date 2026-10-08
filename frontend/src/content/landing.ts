import dashboardBalance from "../assets/landing/dashboard-balance.webp";
import dashboardBalance2x from "../assets/landing/dashboard-balance@2x.webp";
import dispatchHistory from "../assets/landing/dispatch-history.webp";
import dispatchHistory2x from "../assets/landing/dispatch-history@2x.webp";
import partyOpenOrders from "../assets/landing/party-open-orders.webp";
import partyOpenOrders2x from "../assets/landing/party-open-orders@2x.webp";
import poDetail from "../assets/landing/po-detail.webp";
import poDetail2x from "../assets/landing/po-detail@2x.webp";
import poSummary from "../assets/landing/po-summary.webp";
import poSummary2x from "../assets/landing/po-summary@2x.webp";
import stepDispatch from "../assets/landing/step-dispatch.webp";
import stepDispatch2x from "../assets/landing/step-dispatch@2x.webp";
import stepParty from "../assets/landing/step-party.webp";
import stepParty2x from "../assets/landing/step-party@2x.webp";
import stepPo from "../assets/landing/step-po.webp";
import stepPo2x from "../assets/landing/step-po@2x.webp";

import type { LandingContent } from "./landingTypes";

/**
 * Every word and image on the public landing page.
 *
 * One module, because three rules need a single place to look: one primary
 * call to action (XVI), no invented proof (XVII), and nothing claimed that
 * the app does not do (XX / FR-020). tests/unit/landingContent.test.tsx reads
 * this tree directly.
 *
 * Images are imported rather than referenced by path so Vite fingerprints
 * them and a renamed asset fails the build instead of 404ing in production.
 * Dimensions below are the captured 1x sizes recorded in
 * src/assets/landing/manifest.json -- if a re-capture changes them, change
 * them here too.
 */

const trialLine = (trialDays?: number) =>
  trialDays
    ? `${trialDays}-day free trial · No credit card required`
    : "Free trial · No credit card required";

const landingContent: LandingContent = {
  nav: {
    logoLabel: "OrderFlow",
    links: [
      { label: "Pricing", to: "/pricing", emphasis: "soft" },
      { label: "Log in", to: "/login", emphasis: "soft" },
    ],
    primaryAction: { label: "Start free trial", to: "/signup", emphasis: "primary" },
  },

  hero: {
    eyebrow: "For traders and material dealers",
    headline: "Know exactly what's left to deliver on every order",
    subcopy:
      "OrderFlow tracks purchase orders and every partial dispatch against them, so the remaining balance is always the real one — not a number someone reconciled last week.",
    primaryAction: { label: "Start your free trial", to: "/signup", emphasis: "primary" },
    secondaryAction: { label: "See how it works", to: "#how-it-works", emphasis: "soft" },
    trialMicrocopy: trialLine,
    image: {
      src: poDetail,
      src2x: poDetail2x,
      width: 720,
      height: 444,
      alt: "A purchase order in OrderFlow for 1,000 ton of steel bars, showing Ordered 1,000, Dispatched 400 and Remaining 600, with a form to record the next dispatch and a history of the two already sent.",
      loading: "eager",
    },
    mobileImage: {
      src: poSummary,
      src2x: poSummary2x,
      width: 560,
      height: 88,
      alt: "A purchase order in OrderFlow showing Ordered 1,000, Dispatched 400 and Remaining 600.",
      loading: "eager",
    },
  },

  proof: {
    heading: "Built for teams who deliver in parts",
    industries: ["Steel", "Cement", "Hardware", "Pipes", "Chemicals"],
    subline: "Made for the orders you currently track across a spreadsheet and a chat thread.",
  },

  problemOutcomeHeading: "The order is placed. Then the hard part starts.",
  problemOutcome: [
    {
      pain: "A load goes out, someone updates a spreadsheet, someone else doesn't. Nobody agrees on what's still owed.",
      outcome:
        "Record each dispatch once. The remaining balance recalculates from the dispatches themselves, for everyone at the same moment.",
    },
    {
      pain: "A customer asks how much of their order is still pending, and answering means scrolling a chat thread.",
      outcome: "Open the party and see every open order, what's remaining on each, and when it's due.",
    },
    {
      pain: "You find out an order is short on the day it was due.",
      outcome: "The dashboard separates what's on track from what's due soon and what's overdue, before the call comes.",
    },
  ],

  featuresHeading: "Everything you need to stop guessing what's left to deliver",
  features: [
    {
      title: "A remaining balance that is always current",
      copy:
        "Every dispatch you record updates the balance immediately. Nothing is stored and left to drift — the figure you see is calculated from the dispatches behind it.",
      bullet: "See the total across all orders, and the split by party, on one screen.",
      image: {
        src: dashboardBalance,
        src2x: dashboardBalance2x,
        width: 640,
        height: 267,
        alt: "The OrderFlow dashboard showing a total remaining balance of 1,600 across three active purchase orders, three orders on track, and a bar chart of remaining balance split between two parties.",
        loading: "lazy",
      },
      imageSide: "right",
    },
    {
      title: "Partial dispatches, with the history behind them",
      copy:
        "One order, as many deliveries as it takes. Log the date, quantity and vehicle reference as each load leaves, and the order keeps its own record of what went when.",
      bullet: "Ordered, Dispatched and Remaining sit side by side on the order.",
      image: {
        src: dispatchHistory,
        src2x: dispatchHistory2x,
        width: 640,
        height: 103,
        alt: "The dispatch history on an OrderFlow purchase order, listing two dispatches of 250 and 150 with their dates and vehicle references.",
        loading: "lazy",
      },
      imageSide: "left",
    },
    {
      title: "Every party's open orders in one place",
      copy:
        "Open a customer or supplier and see what they have outstanding — which orders, how much is left on each, and the due date you promised.",
      bullet: null,
      image: {
        src: partyOpenOrders,
        src2x: partyOpenOrders2x,
        width: 640,
        height: 122,
        alt: "A party page in OrderFlow listing that party's open purchase orders with their material, remaining quantity, status and due date.",
        loading: "lazy",
      },
      imageSide: "right",
    },
  ],

  stepsHeading: "Up and running in three steps",
  steps: [
    {
      number: 1,
      title: "Add the parties you trade with",
      text: "Your customers and suppliers, with the code and city you already use for them.",
      image: {
        src: stepParty,
        src2x: stepParty2x,
        width: 320,
        height: 61,
        alt: "A party's open orders listed in OrderFlow.",
        loading: "lazy",
      },
    },
    {
      number: 2,
      title: "Raise a purchase order",
      text: "Material, quantity, unit and the due date you're expecting delivery by.",
      image: {
        src: stepPo,
        src2x: stepPo2x,
        width: 320,
        height: 51,
        alt: "A purchase order header in OrderFlow showing Ordered, Dispatched and Remaining quantities.",
        loading: "lazy",
      },
    },
    {
      number: 3,
      title: "Record dispatches as they go out",
      text: "Each partial delivery updates the remaining balance for you and everyone on your team.",
      image: {
        src: stepDispatch,
        src2x: stepDispatch2x,
        width: 320,
        height: 51,
        alt: "Two recorded dispatches against one OrderFlow purchase order.",
        loading: "lazy",
      },
    },
  ],

  trust: {
    heading: "Your order book, handled carefully",
    statements: [
      {
        title: "Roles that match who does what",
        text: "Owner, Manager, Staff and Viewer. Staff can record dispatches without touching billing or team settings.",
      },
      {
        title: "A record of every change",
        text: "Creating, editing and deleting parties, orders and dispatches is logged with who did it and when.",
      },
      {
        title: "Your data stays yours",
        text: "Every record belongs to your organisation and is scoped to it at the database, not just hidden in the interface.",
      },
    ],
    legalLinks: [
      { label: "Privacy", to: "/privacy", emphasis: "soft" },
      { label: "Terms", to: "/terms", emphasis: "soft" },
    ],
  },

  finalCta: {
    headline: "See your remaining balances update as you dispatch",
    action: { label: "Start your free trial", to: "/signup", emphasis: "primary" },
    microcopy: trialLine,
  },

  footer: {
    links: [
      { label: "Pricing", to: "/pricing", emphasis: "soft" },
      { label: "Log in", to: "/login", emphasis: "soft" },
      { label: "Terms", to: "/terms", emphasis: "soft" },
      { label: "Privacy", to: "/privacy", emphasis: "soft" },
    ],
  },
};

export default landingContent;
