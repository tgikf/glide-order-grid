import { useEffect } from "react";
import { FXOrder, generateTrader } from "./utils.ts";

export function usesUpdatingOrders(
  setOrders: React.Dispatch<React.SetStateAction<FXOrder[]>>,
  createInterval: number,
  fillInterval: number,
) {
  useEffect(() => {
    let nextId = 10000;

    const interval = setInterval(() => {
      const currencyPair = ["USD/EUR", "GBP/USD", "JPY/USD", "AUD/CAD"][
        Math.floor(Math.random() * 4)
      ];
      const side = Math.random() > 0.5 ? "BUY" : "SELL";
      const orderQuantity = Math.floor(Math.random() * 1000000) + 100000;
      const limitPrice = Number((Math.random() * 1.5 + 0.5).toFixed(4));
      const trader = generateTrader();
      const venue = ["JPM", "CITI", "BARC", "GS", "MS"][
        Math.floor(Math.random() * 5)
      ];
      const account = ["Main", "Hedge", "Client-A", "Client-B"][
        Math.floor(Math.random() * 4)
      ];
      const strategy = ["Momentum", "Mean Reversion", "Carry", "Volatility"][
        Math.floor(Math.random() * 4)
      ];
      const createdTime = new Date();

      const hasChildren = Math.random() > 0.5;
      const rootId = `order-${nextId++}`;
      const newOrders: FXOrder[] = [];

      if (hasChildren) {
        const child1Id = `${rootId}-child-0`;
        const child2Id = `${rootId}-child-1`;

        const parentOrder: FXOrder = {
          id: rootId,
          depth: 0,
          parentId: null,
          childIds: [child1Id, child2Id],
          currencyPair,
          side,
          orderQuantity,
          limitPrice,
          filledPrice: null,
          filledQuantity: 0,
          status: "NEW",
          createdTimestamp: createdTime,
          updatedTimestamp: createdTime,
          trader,
          venue,
          account,
          strategy,
          notes: "Order with 2 children",
        };

        newOrders.push(parentOrder);

        const childQuantity = Math.floor(orderQuantity / 2);
        const child1: FXOrder = {
          ...parentOrder,
          id: child1Id,
          depth: 1,
          parentId: rootId,
          childIds: [],
          orderQuantity: childQuantity,
          limitPrice: limitPrice + 0.01,
          createdTimestamp: new Date(createdTime.getTime() + 1000),
          updatedTimestamp: new Date(createdTime.getTime() + 1000),
          notes: `Child 1 for ${rootId}`,
        };
        const child2: FXOrder = {
          ...child1,
          id: child2Id,
          limitPrice: limitPrice - 0.01,
          createdTimestamp: new Date(createdTime.getTime() + 2000),
          updatedTimestamp: new Date(createdTime.getTime() + 2000),
          notes: `Child 2 for ${rootId}`,
        };

        newOrders.push(child1, child2);
      } else {
        const simpleOrder: FXOrder = {
          id: rootId,
          depth: 0,
          parentId: null,
          childIds: [],
          currencyPair,
          side,
          orderQuantity,
          limitPrice,
          filledPrice: null,
          filledQuantity: 0,
          status: "NEW",
          createdTimestamp: createdTime,
          updatedTimestamp: createdTime,
          trader,
          venue,
          account,
          strategy,
          notes: "Order without children",
        };

        newOrders.push(simpleOrder);
      }

      setOrders((prev) => [...prev, ...newOrders]);

      const newOrderIds = new Set(newOrders.map((o) => o.id));

      setTimeout(() => {
        setOrders((prev) =>
          prev.map((order) => {
            if (newOrderIds.has(order.id) && order.status !== "CANCELLED") {
              return {
                ...order,
                status: "FILLED",
                filledQuantity: order.orderQuantity,
                filledPrice:
                  order.limitPrice + (Math.random() > 0.5 ? 0.0025 : -0.0025),
                updatedTimestamp: new Date(),
              };
            }
            return order;
          }),
        );
      }, fillInterval);
    }, createInterval);

    const randomFillInterval = setInterval(() => {
      setOrders((prev) => {
        const potentialOrders = prev.filter(
          (o) => o.status !== "CANCELLED" && o.status !== "FILLED",
        );
        if (potentialOrders.length === 0) return prev;

        const countToUpdate = Math.min(
          potentialOrders.length,
          Math.floor(Math.random() * 20) + 1,
        );
        const indicesToUpdate = new Set<number>();
        while (indicesToUpdate.size < countToUpdate) {
          indicesToUpdate.add(
            Math.floor(Math.random() * potentialOrders.length),
          );
        }

        const idsToUpdate = new Set(
          Array.from(indicesToUpdate).map((idx) => potentialOrders[idx].id),
        );

        return prev.map((order) => {
          if (idsToUpdate.has(order.id)) {
            const isFullyFilled = Math.random() > 0.3;
            const newStatus = isFullyFilled ? "FILLED" : "PARTIALLY_FILLED";
            const newFilledQuantity = isFullyFilled
              ? order.orderQuantity
              : Math.floor(order.orderQuantity * Math.random());

            return {
              ...order,
              status: newStatus,
              filledQuantity: newFilledQuantity,
              filledPrice:
                order.limitPrice + (Math.random() > 0.5 ? 0.001 : -0.001),
              updatedTimestamp: new Date(),
            };
          }
          return order;
        });
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(randomFillInterval);
    };
  }, [setOrders]);
}
