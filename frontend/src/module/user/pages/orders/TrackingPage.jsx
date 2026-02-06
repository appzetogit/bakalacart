import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { ArrowLeft, Share2, RefreshCcw, Home, UtensilsCrossed, ChevronRight, Shield, Phone } from 'lucide-react';
// Mock data removed - using API data only

// --- 1. Google Map Styles (Light Theme - as shown in image) ---
const lightMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#333333" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#666666" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#666666" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e0e0e0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#f0f0f0" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#e3f2fd" }],
  },
];

const containerStyle = {
  width: '100%',
  height: '100vh',
};

const TrackingPage = () => {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [loading, setLoading] = useState(true)
  const [orderData, setOrderData] = useState(null)
  
  // Map coordinates
  const [restaurantPos, setRestaurantPos] = useState(null)
  const [userPos, setUserPos] = useState(null)
  const [center, setCenter] = useState(null)
  
  // Order details
  const [restaurantName, setRestaurantName] = useState("")
  const [orderStatus, setOrderStatus] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [arrivalTime, setArrivalTime] = useState("")
  const [distance, setDistance] = useState("")
  const [progress, setProgress] = useState(0)
  const [contactPerson, setContactPerson] = useState({ name: "", phone: "" })
  const [deliveryAddress, setDeliveryAddress] = useState("")

  // Fetch order tracking data from API
  useEffect(() => {
    const fetchTrackingData = async () => {
      if (!orderId) return
      
      try {
        setLoading(true)
        // TODO: Fetch order tracking data from API
        // Example:
        // const response = await userAPI.getOrderTracking(orderId)
        // const data = response.data
        // setRestaurantName(data.restaurantName || "")
        // setOrderStatus(data.status || "")
        // setStatusMessage(data.statusMessage || "")
        // setArrivalTime(data.estimatedArrival || "")
        // setDistance(data.distance || "")
        // setProgress(data.progress || 0)
        // setContactPerson({
        //   name: data.contactName || "",
        //   phone: data.contactPhone || ""
        // })
        // setDeliveryAddress(data.deliveryAddress || "")
        // 
        // // Set map coordinates
        // if (data.restaurantLocation) {
        //   setRestaurantPos({
        //     lat: data.restaurantLocation.lat,
        //     lng: data.restaurantLocation.lng
        //   })
        // }
        // if (data.deliveryLocation) {
        //   setUserPos({
        //     lat: data.deliveryLocation.lat,
        //     lng: data.deliveryLocation.lng
        //   })
        // }
        // 
        // // Calculate center point
        // if (restaurantPos && userPos) {
        //   setCenter({
        //     lat: (restaurantPos.lat + userPos.lat) / 2,
        //     lng: (restaurantPos.lng + userPos.lng) / 2
        //   })
        // }
      } catch (error) {
        console.error("Error fetching tracking data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTrackingData()
  }, [orderId])

  // Calculate center when positions are available
  useEffect(() => {
    if (restaurantPos && userPos) {
      setCenter({
        lat: (restaurantPos.lat + userPos.lat) / 2,
        lng: (restaurantPos.lng + userPos.lng) / 2
      })
    }
  }, [restaurantPos, userPos])

  if (loading) {
    return (
      <div className="relative min-h-screen bg-gray-900 font-sans overflow-hidden flex items-center justify-center">
        <p className="text-white">Loading tracking information...</p>
      </div>
    )
  }

  if (!orderData && !restaurantName) {
    return (
      <div className="relative min-h-screen bg-gray-900 font-sans overflow-hidden flex items-center justify-center">
        <p className="text-white">Order tracking information not available.</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-gray-900 font-sans overflow-hidden">
      
      {/* --- 2. Floating Header (Green) --- */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-[#23633F] p-4 pt-4 rounded-b-2xl shadow-lg">
        <div className="flex items-center justify-between text-white mb-3">
          <ArrowLeft 
            className="w-6 h-6 cursor-pointer" 
            onClick={() => navigate(-1)}
          />
          <div className="flex items-center gap-2">
            {restaurantName && (
              <span className="font-semibold text-lg">{restaurantName}</span>
            )}
          </div>
          <Share2 className="w-5 h-5 cursor-pointer" />
        </div>
        
        <div className="text-center text-white">
          {orderStatus && (
            <h2 className="text-2xl font-bold mb-3 capitalize">{orderStatus}</h2>
          )}
          {statusMessage && (
            <div className="flex items-center justify-center gap-2 bg-[#1a4d31] w-fit mx-auto px-4 py-2 rounded-full">
              <span className="text-sm font-medium">{statusMessage}</span>
              <RefreshCcw className="w-4 h-4 text-green-200" />
            </div>
          )}
        </div>
      </div>

      {/* --- 3. Google Map Background --- */}
      {center && restaurantPos && userPos && (
        <div className="absolute top-0 left-0 w-full h-full z-0">
          <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY"}> 
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={13}
              options={{
                styles: lightMapStyle,
                disableDefaultUI: true,
                zoomControl: false,
              }}
            >
              {/* Markers */}
              <Marker 
                position={restaurantPos} 
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/restaurant.png",
                  scaledSize: new window.google.maps.Size(40, 40)
                }}
              />
              <Marker 
                position={userPos} 
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/homegardenbusiness.png",
                  scaledSize: new window.google.maps.Size(40, 40)
                }}
              />
              {/* Dotted Polyline */}
              <Polyline
                path={[restaurantPos, userPos]}
                options={{
                  strokeColor: "#23633F",
                  strokeOpacity: 0.8,
                  strokeWeight: 3,
                  icons: [{
                    icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
                    offset: "0",
                    repeat: "20px",
                  }],
                }}
              />
            </GoogleMap>
          </LoadScript>

          {/* Map Overlay - Arrival Time Card */}
          {(arrivalTime || distance) && (
            <div className="absolute bottom-[50vh] left-4 right-4 z-10 bg-white rounded-xl p-4 shadow-lg border border-gray-200">
              <p className="text-xs text-gray-600 mb-1 uppercase">ARRIVING IN</p>
              {arrivalTime && (
                <p className="text-3xl font-bold text-red-600 mb-1">{arrivalTime}</p>
              )}
              {distance && (
                <p className="text-sm text-gray-600 mb-2">{distance} away</p>
              )}
              {progress > 0 && (
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#23633F] rounded-full" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- 4. Bottom Sheet (Dark Overlay) - Scrollable Content --- */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#141414] rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.5)] max-h-[50vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          {/* Order Status Card */}
          {statusMessage && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center">
                  <UtensilsCrossed className="w-6 h-6 text-red-400" />
                </div>
                <p className="font-semibold text-white">{statusMessage}</p>
              </div>
            </div>
          )}

          {/* Delivery Partner Safety Card */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-gray-400" />
              <span className="flex-1 text-left font-medium text-white">
                Learn about delivery partner safety
              </span>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </div>
          </div>

          {/* Delivery Details Banner */}
          <div className="bg-yellow-900/30 rounded-xl p-4 border border-yellow-800/50">
            <p className="text-yellow-300 font-medium text-center">
              All your delivery details in one place 👋
            </p>
          </div>

          {/* Contact Person Card */}
          {(contactPerson.name || contactPerson.phone) && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  {contactPerson.name && (
                    <p className="font-semibold text-white">{contactPerson.name}</p>
                  )}
                  {contactPerson.phone && (
                    <p className="text-sm text-gray-400">{contactPerson.phone}</p>
                  )}
                </div>
                <span className="text-green-400 font-medium text-sm cursor-pointer">Edit</span>
              </div>
            </div>
          )}

          {/* Delivery Location Card */}
          {deliveryAddress && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
              <div className="flex items-center gap-3">
                <Home className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="font-semibold text-white">Delivery at Location</p>
                  <p className="text-sm text-gray-400">{deliveryAddress}</p>
                </div>
                <span className="text-green-400 font-medium text-sm cursor-pointer">Edit</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;

