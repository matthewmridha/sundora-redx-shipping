import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  ResourceList,
  ResourceItem,
  TextStyle,
  Button,
  Stack,
  Badge,
  Frame,
  Toast,
  Spinner,
  Filters,
  AppProvider,
  Page,
  Layout,
  Banner,
} from "@shopify/polaris";
import {
  getFulfilledOrders,
  hasTrackingNumber,
  getFulfillmentId,
} from "../utils/shopifyService";
import { createRedxShipment } from "../utils/redxService";
import { updateFulfillmentTracking } from "../utils/shopifyService";

function OrderList() {
  const [orders, setOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState("");
  const [toastError, setToastError] = useState(false);
  const [showTracked, setShowTracked] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedOrders = await getFulfilledOrders();

      if (!showTracked) {
        // Filter out orders that already have tracking numbers
        const filteredOrders = fetchedOrders.filter(
          (order) => !hasTrackingNumber(order)
        );
        setOrders(filteredOrders);
      } else {
        setOrders(fetchedOrders);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setToastContent("Failed to fetch orders. Please try again.");
      setToastError(true);
      setToastActive(true);
      setLoading(false);
    }
  }, [showTracked]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSelectionChange = (selectedItems) => {
    setSelectedOrders(selectedItems);
  };

  const handleShipOrder = async (orderId) => {
    try {
      setProcessing(true);
      const order = orders.find((o) => o.id.toString() === orderId);

      if (!order) {
        throw new Error("Order not found");
      }

      // Create RedX shipment
      const redxResponse = await createRedxShipment(order);

      if (!redxResponse || !redxResponse.tracking_id) {
        throw new Error("Failed to get tracking ID from RedX");
      }

      // Update fulfillment tracking
      const fulfillmentId = getFulfillmentId(order);

      if (!fulfillmentId) {
        throw new Error("No fulfillment found for this order");
      }

      await updateFulfillmentTracking(fulfillmentId, redxResponse.tracking_id);

      // Update local state
      setOrders((prevOrders) =>
        prevOrders.map((o) =>
          o.id === order.id
            ? {
                ...o,
                fulfillments: o.fulfillments.map((f) => ({
                  ...f,
                  tracking_number: redxResponse.tracking_id,
                  tracking_url: `https://redx.com.bd/track-parcel/?trackingId=${redxResponse.tracking_id}`,
                })),
              }
            : o
        )
      );

      setToastContent(
        `Successfully created RedX shipment for order ${order.name}`
      );
      setToastError(false);
      setToastActive(true);
      setProcessing(false);

      // Refresh orders
      fetchOrders();
    } catch (error) {
      console.error("Error shipping order:", error);
      setToastContent(`Failed to create shipment: ${error.message}`);
      setToastError(true);
      setToastActive(true);
      setProcessing(false);
    }
  };

  const handleBulkShip = async () => {
    if (selectedOrders.length === 0) {
      setToastContent("Please select at least one order to ship");
      setToastError(true);
      setToastActive(true);
      return;
    }

    setProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const orderId of selectedOrders) {
      try {
        const order = orders.find((o) => o.id.toString() === orderId);

        if (!order) {
          failCount++;
          continue;
        }

        // Create RedX shipment
        const redxResponse = await createRedxShipment(order);

        if (!redxResponse || !redxResponse.tracking_id) {
          failCount++;
          continue;
        }

        // Update fulfillment tracking
        const fulfillmentId = getFulfillmentId(order);

        if (!fulfillmentId) {
          failCount++;
          continue;
        }

        await updateFulfillmentTracking(
          fulfillmentId,
          redxResponse.tracking_id
        );
        successCount++;
      } catch (error) {
        console.error(`Error shipping order ${orderId}:`, error);
        failCount++;
      }
    }

    setToastContent(
      `Processed ${selectedOrders.length} orders: ${successCount} successful, ${failCount} failed`
    );
    setToastError(failCount > 0);
    setToastActive(true);
    setProcessing(false);
    setSelectedOrders([]);

    // Refresh orders
    fetchOrders();
  };

  const toggleToast = useCallback(
    () => setToastActive((active) => !active),
    []
  );

  const renderItem = (item) => {
    const {
      id,
      name,
      created_at,
      shipping_address,
      total_price,
      fulfillment_status,
      fulfillments,
    } = item;
    const hasTracking = hasTrackingNumber(item);

    return (
      <ResourceItem
        id={id.toString()}
        accessibilityLabel={`View details for ${name}`}
      >
        <Stack distribution="fillEvenly" alignment="center">
          <Stack.Item>
            <TextStyle variation="strong">{name}</TextStyle>
            <div>{new Date(created_at).toLocaleDateString()}</div>
          </Stack.Item>

          <Stack.Item>
            {shipping_address && (
              <div>
                {shipping_address.name}
                <br />
                {shipping_address.address1}
                <br />
                {shipping_address.city}, {shipping_address.country}
              </div>
            )}
          </Stack.Item>

          <Stack.Item>
            <div>
              <TextStyle variation="strong">Total:</TextStyle> {total_price}
            </div>
            <div>
              <Badge
                status={
                  fulfillment_status === "fulfilled" ? "success" : "attention"
                }
              >
                {fulfillment_status || "Unfulfilled"}
              </Badge>
            </div>
            {hasTracking && (
              <div>
                <Badge status="info">
                  Tracking: {fulfillments[0].tracking_number}
                </Badge>
              </div>
            )}
          </Stack.Item>

          <Stack.Item>
            {!hasTracking && (
              <Button
                primary
                onClick={() => handleShipOrder(id.toString())}
                disabled={processing}
              >
                SHIP REDX
              </Button>
            )}
            {hasTracking && (
              <Button plain url={fulfillments[0].tracking_url} external>
                TRACK
              </Button>
            )}
          </Stack.Item>
        </Stack>
      </ResourceItem>
    );
  };

  const filterControl = (
    <Filters
      filters={[]}
      appliedFilters={[]}
      hideQueryField
      queryPlaceholder="Filter orders"
    >
      <div style={{ paddingLeft: "8px" }}>
        <Button onClick={() => setShowTracked(!showTracked)} plain>
          {showTracked ? "Hide orders with tracking" : "Show all orders"}
        </Button>
      </div>
    </Filters>
  );

  return (
    <AppProvider i18n={{}}>
      <Frame>
        {toastActive && (
          <Toast
            content={toastContent}
            error={toastError}
            onDismiss={toggleToast}
          />
        )}

        <Page title="RedX Shipping">
          <Layout>
            <Layout.Section>
              <Banner title="RedX Shipping Integration" status="info">
                <p>
                  Create shipments in RedX for your fulfilled orders. When you
                  create a shipment, the tracking information will be added to
                  the fulfillment.
                </p>
              </Banner>
            </Layout.Section>

            <Layout.Section>
              <Card>
                {loading ? (
                  <div style={{ textAlign: "center", padding: "2rem" }}>
                    <Spinner size="large" />
                  </div>
                ) : (
                  <ResourceList
                    resourceName={{ singular: "order", plural: "orders" }}
                    items={orders}
                    renderItem={renderItem}
                    selectedItems={selectedOrders}
                    onSelectionChange={handleSelectionChange}
                    selectable
                    filterControl={filterControl}
                  />
                )}
              </Card>
            </Layout.Section>

            {selectedOrders.length > 0 && (
              <div
                style={{
                  position: "fixed",
                  bottom: "20px",
                  right: "20px",
                  zIndex: 1000,
                }}
              >
                <Button
                  primary
                  size="large"
                  onClick={handleBulkShip}
                  disabled={processing}
                >
                  {processing ? (
                    <Stack alignment="center" spacing="tight">
                      <Spinner size="small" />
                      <span>Processing...</span>
                    </Stack>
                  ) : (
                    `Ship ${selectedOrders.length} Orders with RedX`
                  )}
                </Button>
              </div>
            )}
          </Layout>
        </Page>
      </Frame>
    </AppProvider>
  );
}

export default OrderList;
