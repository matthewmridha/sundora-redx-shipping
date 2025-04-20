import axios from "axios";
import { CONFIG } from "./config";
import areasData from "../data/areas.json";

export const findDeliveryArea = (address, city) => {
  if (!address || !city) return null;

  // Extract the area from the address (after the last comma)
  const addressParts = address.split(",");
  const areaCandidate = addressParts[addressParts.length - 1].trim();

  // Find a matching area in our areas.json
  const matchedArea = areasData.areas.find((area) => {
    return (
      area.district_name.toLowerCase() === city.toLowerCase() &&
      area.name.toLowerCase().includes(areaCandidate.toLowerCase())
    );
  });

  return matchedArea;
};

export const extractAddress = (fullAddress) => {
  if (!fullAddress) return "";

  const lastCommaIndex = fullAddress.lastIndexOf(",");
  if (lastCommaIndex === -1) return fullAddress;

  return fullAddress.substring(0, lastCommaIndex).trim();
};

export const createRedxShipment = async (orderData) => {
  try {
    const shippingAddress = orderData.shipping_address;
    const customerAddress = extractAddress(shippingAddress.address1);

    // Find matching delivery area
    const deliveryArea = findDeliveryArea(
      shippingAddress.address1,
      shippingAddress.city
    );

    if (!deliveryArea) {
      throw new Error("Unable to find matching delivery area for this address");
    }

    // Prepare parcel details from line items
    const parcelDetails = orderData.line_items.map((item) => ({
      name: item.name,
      category: item.vendor,
      value: parseFloat(item.price),
    }));

    // Prepare request body
    const requestBody = {
      customer_name: `${shippingAddress.first_name} ${shippingAddress.last_name}`,
      customer_phone: shippingAddress.phone,
      delivery_area: deliveryArea.name,
      delivery_area_id: deliveryArea.redx_id,
      customer_address: customerAddress,
      merchant_invoice_id: orderData.name,
      cash_collection_amount: orderData.total_outstanding.toString(),
      parcel_weight: 1000,
      instruction: orderData.note || "",
      value: parseFloat(orderData.total_line_items_price),
      is_closed_box: true,
      parcel_details_json: parcelDetails,
    };

    // Make API call to RedX
    const response = await axios.post(CONFIG.REDX_API_URL, requestBody, {
      headers: {
        "API-ACCESS-TOKEN": `Bearer ${CONFIG.REDX_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error creating RedX shipment:", error);
    throw error;
  }
};
