import axios from "axios";
import { CONFIG } from "./config";

export const getAccessToken = () => {
  // In a production app, you would securely store and retrieve this
  // For a custom app, this will be provided during app installation
  return "7ba4ec8378de74efe1c458e370f81d9a"; // API secret key
};

export const getFulfilledOrders = async (limit = 50) => {
  try {
    const response = await axios.get(
      `https://${CONFIG.SHOP_DOMAIN}/admin/api/${CONFIG.SHOPIFY_API_VERSION}/orders.json?status=any&fulfillment_status=fulfilled&limit=${limit}`,
      {
        headers: {
          "X-Shopify-Access-Token": getAccessToken(),
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.orders;
  } catch (error) {
    console.error("Error fetching orders:", error);
    throw error;
  }
};

export const updateFulfillmentTracking = async (
  fulfillmentId,
  trackingNumber
) => {
  try {
    const trackingUrl = `https://redx.com.bd/track-parcel/?trackingId=${trackingNumber}`;

    const graphqlQuery = {
      query: `
        mutation FulfillmentTrackingInfoUpdate($fulfillmentId: ID!, $trackingInfoInput: FulfillmentTrackingInput!, $notifyCustomer: Boolean) {
          fulfillmentTrackingInfoUpdate(
            fulfillmentId: $fulfillmentId,
            trackingInfoInput: $trackingInfoInput,
            notifyCustomer: $notifyCustomer
          ) {
            fulfillment {
              id
              status
              trackingInfo {
                company
                number
                url
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        fulfillmentId: fulfillmentId,
        notifyCustomer: true,
        trackingInfoInput: {
          company: "RedX",
          number: trackingNumber,
          url: trackingUrl,
        },
      },
    };

    const response = await axios.post(
      `https://${CONFIG.SHOP_DOMAIN}/admin/api/${CONFIG.SHOPIFY_API_VERSION}/graphql.json`,
      graphqlQuery,
      {
        headers: {
          "X-Shopify-Access-Token": getAccessToken(),
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error updating fulfillment tracking:", error);
    throw error;
  }
};

export const hasTrackingNumber = (order) => {
  if (!order.fulfillments || order.fulfillments.length === 0) return false;

  // Check if any fulfillment has a tracking number
  return order.fulfillments.some(
    (fulfillment) =>
      fulfillment.tracking_number && fulfillment.tracking_number.length > 0
  );
};

export const getFulfillmentId = (order) => {
  if (!order.fulfillments || order.fulfillments.length === 0) return null;

  // Get the first fulfillment id
  return order.fulfillments[0].admin_graphql_api_id;
};
