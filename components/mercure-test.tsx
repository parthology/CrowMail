"use client"

import { useState, useEffect } from "react"
import { Button } from "@heroui/button"
import { Card, CardBody, CardHeader } from "@heroui/card"
import { useAuth } from "@/contexts/auth-context"
import { useApiProvider } from "@/contexts/api-provider-context"

export function MercureTest() {
  const { currentAccount } = useAuth()
  const { getProviderById } = useApiProvider()
  const [isConnected, setIsConnected] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connectToMercure = () => {
    if (!currentAccount) {
      setError("You must sign in to an account first")
      return
    }

    // Get the current account's provider config
    const providerId = currentAccount.providerId || "crowmail"
    const provider = getProviderById(providerId)

    if (!provider) {
      setError(`Provider config not found: ${providerId}`)
      return
    }

    try {
      // Build the Mercure URL - uses the current account's provider config
      const mercureUrl = new URL(provider.mercureUrl)
      mercureUrl.searchParams.append("topic", `/accounts/${currentAccount.id}`)

      console.log("🔌 Connecting to Mercure:", mercureUrl.toString())
      
      const es = new EventSource(mercureUrl.toString())
      setEventSource(es)
      setError(null)

      es.onopen = () => {
        console.log("✅ Mercure connected")
        setIsConnected(true)
        setEvents(prev => [...prev, {
          type: "connection",
          message: "Connected to Mercure",
          timestamp: new Date().toISOString()
        }])
      }

      es.onmessage = (event) => {
        console.log("📨 Mercure message:", event.data)
        try {
          const data = JSON.parse(event.data)
          setEvents(prev => [...prev, {
            type: "message",
            data: data,
            timestamp: new Date().toISOString()
          }])
        } catch (e) {
          setEvents(prev => [...prev, {
            type: "raw",
            message: event.data,
            timestamp: new Date().toISOString()
          }])
        }
      }

      es.onerror = (error) => {
        console.error("❌ Mercure error:", error)
        setIsConnected(false)
        setError("Connection error - the Mercure service may be unavailable")
        setEvents(prev => [...prev, {
          type: "error",
          message: "Connection error",
          timestamp: new Date().toISOString()
        }])
      }

    } catch (error: any) {
      console.error("❌ Failed to connect:", error)
      setError(`Connection failed: ${error.message}`)
    }
  }

  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      setEventSource(null)
      setIsConnected(false)
      setEvents(prev => [...prev, {
        type: "connection",
        message: "Disconnected",
        timestamp: new Date().toISOString()
      }])
    }
  }

  const clearEvents = () => {
    setEvents([])
  }

  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [eventSource])

  if (!currentAccount) {
    return (
      <Card className="max-w-md mx-auto">
        <CardBody>
          <p className="text-center text-gray-500">Please sign in to an account first to test the Mercure feature</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">CrowMail Mercure Realtime Feature Test</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isConnected ? 'Connected' : 'Not connected'}</span>
            </div>
            
            <div className="flex gap-2">
              {!isConnected ? (
                <Button color="primary" onPress={connectToMercure}>
                  Connect to Mercure
                </Button>
              ) : (
                <Button color="danger" onPress={disconnect}>
                  Disconnect
                </Button>
              )}
              <Button variant="flat" onPress={clearEvents}>
                Clear log
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-medium">Connection info:</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Account ID:</strong> {currentAccount.id}</p>
              <p><strong>Mercure Topic:</strong> /accounts/{currentAccount.id}</p>
              <p><strong>Event count:</strong> {events.length}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h4 className="font-medium">Realtime event log</h4>
        </CardHeader>
        <CardBody>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No events yet</p>
            ) : (
              events.map((event, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-medium ${
                      event.type === 'error' ? 'text-red-600' :
                      event.type === 'connection' ? 'text-blue-600' :
                      'text-green-600'
                    }`}>
                      {event.type}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-700">
                    {event.data ? (
                      <pre className="whitespace-pre-wrap text-xs">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    ) : (
                      event.message
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
