export interface FXOrder {
  id: string;
  depth: number;
  parentId: string | null;
  childIds: string[];
  currencyPair: string;
  side: "BUY" | "SELL";
  orderQuantity: number;
  limitPrice: number;
  filledPrice: number | null;
  filledQuantity: number;
  status: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" | "REJECTED";
  createdTimestamp: Date;
  updatedTimestamp: Date;
  trader: string;
  venue: string;
  account: string;
  strategy: string;
  notes: string;
}

const generateCurrencyPair = () => {
  const baseCurrencies = [
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "AUD",
    "NZD",
    "CAD",
    "CHF",
  ];
  const quoteCurrencies = [
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "AUD",
    "NZD",
    "CAD",
    "CHF",
  ];

  let base = baseCurrencies[Math.floor(Math.random() * baseCurrencies.length)];
  let quote;

  do {
    quote = quoteCurrencies[Math.floor(Math.random() * quoteCurrencies.length)];
  } while (base === quote);

  return `${base}/${quote}`;
};

const randomDecimal = (min: number, max: number, decimals: number = 4) => {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
};

const randomDate = (start: Date, end: Date) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
};

const generateTrader = () => {
  const firstNames = [
    "John",
    "Jane",
    "Alex",
    "Sarah",
    "Michael",
    "Emma",
    "David",
    "Olivia",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Jones",
    "Brown",
    "Davis",
    "Miller",
    "Wilson",
  ];

  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

  return `${firstName} ${lastName}`;
};

const generateVenue = () => {
  const venues = [
    "JPM",
    "CITI",
    "BARC",
    "GS",
    "MS",
    "HSBC",
    "UBS",
    "CS",
    "DB",
    "BOA",
  ];
  return venues[Math.floor(Math.random() * venues.length)];
};

const generateAccount = () => {
  const accounts = [
    "Main",
    "Hedge",
    "Client-A",
    "Client-B",
    "Client-C",
    "Prop",
    "Alpha",
    "Beta",
    "Delta",
    "Gamma",
  ];
  return accounts[Math.floor(Math.random() * accounts.length)];
};

const generateStrategy = () => {
  const strategies = [
    "Momentum",
    "Mean Reversion",
    "Carry",
    "Volatility",
    "Directional",
    "Arbitrage",
    "Market Making",
    "Trend Following",
  ];
  return strategies[Math.floor(Math.random() * strategies.length)];
};

export const generateTestData = (
  count: number = 30000,
  rootCount: number = 7500
): FXOrder[] => {
  const orders: FXOrder[] = [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);

  const minRequiredRoots = Math.max(5000, rootCount);
  const actualRootCount = Math.min(minRequiredRoots, Math.floor(count * 0.3));

  for (let i = 0; i < actualRootCount; i++) {
    const id = `order-${i}`;
    const currencyPair = generateCurrencyPair();
    const side = Math.random() > 0.5 ? "BUY" : "SELL";
    const orderQuantity = Math.floor(Math.random() * 1000000) + 100000;
    const limitPrice = randomDecimal(0.5, 2);
    const status =
      Math.random() > 0.7
        ? "FILLED"
        : Math.random() > 0.5
        ? "PARTIALLY_FILLED"
        : "NEW";
    const filledQuantity =
      status === "FILLED"
        ? orderQuantity
        : status === "PARTIALLY_FILLED"
        ? Math.floor(orderQuantity * Math.random())
        : 0;
    const filledPrice =
      status === "FILLED" || status === "PARTIALLY_FILLED"
        ? limitPrice + randomDecimal(-0.05, 0.05)
        : null;

    orders.push({
      id,
      depth: 0,
      parentId: null,
      childIds: [],
      currencyPair,
      side,
      orderQuantity,
      limitPrice,
      filledPrice,
      filledQuantity,
      status,
      createdTimestamp: randomDate(startDate, endDate),
      updatedTimestamp: randomDate(startDate, endDate),
      trader: generateTrader(),
      venue: generateVenue(),
      account: generateAccount(),
      strategy: generateStrategy(),
      notes: `Root order for ${currencyPair}`,
    });
  }

  const createChildOrders = (
    parentOrder: FXOrder,
    level: number,
    maxChildren: number,
    remainingCount: number
  ): FXOrder[] => {
    if (level > 5 || remainingCount <= 0) return [];

    let minChildCount, maxPossibleChildren;

    switch (level) {
      case 1:
        minChildCount = Math.min(2, remainingCount);
        maxPossibleChildren = 5;
        break;
      case 2:
        minChildCount = Math.min(2, remainingCount);
        maxPossibleChildren = 4;
        break;
      case 3:
        minChildCount = Math.min(1, remainingCount);
        maxPossibleChildren = 3;
        break;
      case 4:
        minChildCount = 0;
        maxPossibleChildren = 2;
        break;
      default:
        minChildCount = 0;
        maxPossibleChildren = 1;
    }

    const childCount = Math.min(
      Math.max(
        minChildCount,
        Math.floor(Math.random() * (maxPossibleChildren - minChildCount + 1)) +
          minChildCount
      ),
      maxChildren,
      remainingCount
    );

    const children: FXOrder[] = [];

    if (childCount === 0) return children;

    let remainingForChildren = remainingCount - childCount;

    for (let i = 0; i < childCount; i++) {
      const childId = `${parentOrder.id}-child-${i}`;
      const childQuantity = Math.floor(parentOrder.orderQuantity / childCount);
      const childStatus =
        Math.random() > 0.7
          ? "FILLED"
          : Math.random() > 0.5
          ? "PARTIALLY_FILLED"
          : "NEW";
      const childFilledQuantity =
        childStatus === "FILLED"
          ? childQuantity
          : childStatus === "PARTIALLY_FILLED"
          ? Math.floor(childQuantity * Math.random())
          : 0;
      const childFilledPrice =
        childStatus === "FILLED" || childStatus === "PARTIALLY_FILLED"
          ? parentOrder.limitPrice + randomDecimal(-0.02, 0.02)
          : null;

      const childOrder: FXOrder = {
        id: childId,
        depth: level,
        parentId: parentOrder.id,
        childIds: [],
        currencyPair: parentOrder.currencyPair,
        side: parentOrder.side,
        orderQuantity: childQuantity,
        limitPrice: parentOrder.limitPrice + randomDecimal(-0.01, 0.01),
        filledPrice: childFilledPrice,
        filledQuantity: childFilledQuantity,
        status: childStatus,
        createdTimestamp: new Date(
          parentOrder.createdTimestamp.getTime() +
            1000 * 60 * Math.random() * 30
        ),
        updatedTimestamp: new Date(
          parentOrder.createdTimestamp.getTime() +
            1000 * 60 * (Math.random() * 60 + 30)
        ),
        trader: parentOrder.trader,
        venue: generateVenue(),
        account: parentOrder.account,
        strategy: parentOrder.strategy,
        notes: `Child order for ${parentOrder.id}`,
      };

      children.push(childOrder);

      if (level < 5 && remainingForChildren > 0) {
        let grandchildAllocation;

        if (level === 1) {
          grandchildAllocation = Math.max(
            5,
            Math.floor(remainingForChildren / (childCount * 0.7))
          );
        } else if (level === 2) {
          grandchildAllocation = Math.max(
            3,
            Math.floor(remainingForChildren / (childCount * 0.8))
          );
        } else {
          grandchildAllocation = Math.max(
            2,
            Math.floor(remainingForChildren / childCount)
          );
        }

        const grandchildrenLimit = Math.min(
          grandchildAllocation,
          remainingForChildren
        );

        if (grandchildrenLimit > 0) {
          const grandchildren = createChildOrders(
            childOrder,
            level + 1,
            grandchildrenLimit,
            grandchildrenLimit
          );

          childOrder.childIds = grandchildren.map((g) => g.id);
          children.push(...grandchildren);

          remainingForChildren -= grandchildren.length;
        }
      }
    }

    return children;
  };

  const remainingOrdersCount = Math.max(0, count - actualRootCount);

  const minimumChildOrders = actualRootCount * 2.5;

  if (remainingOrdersCount < minimumChildOrders) {
    console.warn(
      `Warning: Only ${remainingOrdersCount} orders available for children. This may result in limited hierarchy.`
    );
  }

  const targetRootsWithChildren = Math.floor(actualRootCount * 0.9);

  const ordersNeededForRichHierarchy = targetRootsWithChildren * 3;

  if (remainingOrdersCount < ordersNeededForRichHierarchy) {
    console.warn(
      `Warning: Only ${remainingOrdersCount} orders available for children. This may result in limited hierarchy. Consider increasing total count.`
    );
  }

  const maxRootsWithChildren = Math.min(
    targetRootsWithChildren,
    Math.floor(remainingOrdersCount / 3)
  );

  const rootsWithChildrenCount = Math.max(1, maxRootsWithChildren);

  const ordersPerRoot = Math.max(
    5,
    Math.floor(remainingOrdersCount / rootsWithChildrenCount)
  );
  let extraOrders =
    remainingOrdersCount - ordersPerRoot * rootsWithChildrenCount;

  const allChildren: FXOrder[] = [];

  const rootIndicesWithChildren: number[] = [];

  const guaranteedLowRoots = Math.floor(rootsWithChildrenCount * 0.3);
  for (let i = 0; i < guaranteedLowRoots && i < actualRootCount; i++) {
    rootIndicesWithChildren.push(i);
  }

  const remainingRoots = [...Array(actualRootCount).keys()]
    .filter((i) => !rootIndicesWithChildren.includes(i))
    .sort(() => Math.random() - 0.5);

  const remainingRootsNeeded =
    rootsWithChildrenCount - rootIndicesWithChildren.length;
  for (let i = 0; i < remainingRootsNeeded && i < remainingRoots.length; i++) {
    rootIndicesWithChildren.push(remainingRoots[i]);
  }

  rootIndicesWithChildren.sort(() => Math.random() - 0.5);

  for (let i = 0; i < rootIndicesWithChildren.length; i++) {
    const rootIndex = rootIndicesWithChildren[i];
    const rootOrder = orders[rootIndex];

    let ordersForThisRoot = ordersPerRoot;
    if (extraOrders > 0) {
      const bonus = Math.min(extraOrders, 5);
      ordersForThisRoot += bonus;
      extraOrders -= bonus;
    }

    if (ordersForThisRoot > 0) {
      const children = createChildOrders(
        rootOrder,
        1,
        ordersForThisRoot,
        ordersForThisRoot
      );

      rootOrder.childIds = children
        .filter((c) => c.parentId === rootOrder.id)
        .map((c) => c.id);

      allChildren.push(...children);
    }
  }

  orders.push(...allChildren);

  console.log(
    `Generated ${orders.length} orders (${actualRootCount} roots, ${allChildren.length} children)`
  );
  console.log(
    `Root orders with children: ${
      orders.filter((o) => o.depth === 0 && o.childIds.length > 0).length
    }`
  );
  console.log(
    `Root orders without children: ${
      orders.filter((o) => o.depth === 0 && o.childIds.length === 0).length
    }`
  );

  const level1Orders = allChildren.filter((o) => o.depth === 1).length;
  const level2Orders = allChildren.filter((o) => o.depth === 2).length;
  const level3Orders = allChildren.filter((o) => o.depth === 3).length;
  const level4Orders = allChildren.filter((o) => o.depth === 4).length;
  const level5OrHigher = allChildren.filter((o) => o.depth >= 5).length;

  console.log(`Orders by depth:`);
  console.log(`- Level 0 (roots): ${actualRootCount}`);
  console.log(`- Level 1: ${level1Orders}`);
  console.log(`- Level 2: ${level2Orders}`);
  console.log(`- Level 3: ${level3Orders}`);
  console.log(`- Level 4: ${level4Orders}`);
  console.log(`- Level 5+: ${level5OrHigher}`);

  const order48 = orders.find((o) => o.id === "order-48");
  const order49 = orders.find((o) => o.id === "order-49");
  const order50 = orders.find((o) => o.id === "order-50");

  console.log(`Order-48 has ${order48?.childIds.length || 0} direct children`);
  console.log(`Order-49 has ${order49?.childIds.length || 0} direct children`);
  console.log(`Order-50 has ${order50?.childIds.length || 0} direct children`);

  const rootsWithChildren = orders.filter(
    (o) => o.depth === 0 && o.childIds.length > 0
  );
  const childCountPerRoot = rootsWithChildren.map((r) => r.childIds.length);
  const avgChildrenPerRoot =
    childCountPerRoot.reduce((a, b) => a + b, 0) /
    (rootsWithChildren.length || 1);
  const maxChildrenPerRoot = Math.max(...childCountPerRoot, 0);

  console.log(`Average children per root: ${avgChildrenPerRoot.toFixed(2)}`);
  console.log(`Maximum children per root: ${maxChildrenPerRoot}`);

  return orders;
};
