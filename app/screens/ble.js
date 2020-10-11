import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Switch, FlatList, PermissionsAndroid, ActivityIndicator, Modal, Alert, TextInput, ScrollView, StyleSheet } from 'react-native'
import Feather from "react-native-feather1s"
import { BleManager } from 'react-native-ble-plx'
import base64 from 'react-native-base64'

let customFonts  = {
  'FuturaH': require('../assets/fonts/futurah.ttf'),
  'FuturaL': require('../assets/fonts/futural.ttf'),
};


export default function Ble() {
  const [isEnable, setIsEnable] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [deviceList, setDeviceList] = useState([])
  const [connectedDevice, setConnectedDevice] = useState({})
  const [isConnected, setIsConnected] = useState(false)

  const [deviceID, setDeviceID] = useState('')
  const [serviceID, setServiceID] = useState('')
  const [characteristicID, setCharacteristicID] = useState('')

  const [sendCommand, setSendCommand] = useState('')
  const [receiveCommand, setReceiveCommand] = useState('')

  const manager = new BleManager

  async function _loadFontsAsync() {
    await Font.loadAsync(customFonts);
    this.setState({ fontsLoaded: true });
  }

  async function verifyStatus() {
    const result = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION)
    if (!result) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION)
    }
    const status = await manager.state()
    if (status === 'PoweredOn') setIsEnable(true)
    if (status === 'PoweredOff') setIsEnable(false)
  }

  async function toogleStatus() {
    try {
      if (isEnable) {
        await manager.disable()
        setIsScanning(false)
        setIsEnable(false)
        setIsConnected(false)
      }
      else {
        await manager.enable()
        setIsEnable(true)
      }
    }
    catch (err) {
      console.log(err)
    }
  }

  async function startScanDevices() {
    setIsScanning(true)

    let list = deviceList.slice()

    manager.startDeviceScan(null, null, (err, device) => {
      if (err) return

      const hasID = list.some(elem => elem.id == device.id)

      if (!hasID) {
        list.push(device)
        setDeviceList(list)
      }
    })

  }

  async function stopScanDevices() {
    setIsScanning(false)
    manager.stopDeviceScan()
  }


  async function connect(device) {

    await device.connect()

    setIsConnected(true)

    setDeviceID(device.id)

    await device.discoverAllServicesAndCharacteristics()
    const services = await device.services()

    services.forEach(async (srv) => {
      if (srv.uuid.startsWith('c00fa')) {
        const customService = srv.uuid

        setServiceID(customService)

        console.log(customService)

        const characteristics = await device.characteristicsForService(customService)

        characteristics.forEach(chrt => {
          if (chrt.uuid.startsWith('c00fa')) {
            const customCharacteristic = chrt.uuid

            setCharacteristicID(customCharacteristic)

            console.log(customCharacteristic)

            setConnectedDevice(device)

            setTimeout(() => startMonitoring(), 100)
          }
        })
      }
    });
  }

  async function disconnect() {
    try {
      manager.cancelTransaction('LISTEN')
      const device = connectedDevice
      await device.cancelConnection()
      setIsConnected(false)
    } catch (err) {
      console.log(err)
    }
  }

  function notAvailableAlert() {
    Alert.alert('Sorry', ('Unable to connect'))
  }

  async function writeCommand() {
    manager.cancelTransaction('LISTEN')
    const encodedCommand = base64.encode(sendCommand)
    await manager.writeCharacteristicWithoutResponseForDevice(deviceID, serviceID, characteristicID, encodedCommand)
    setTimeout(() => startMonitoring(), 200)
  }

  function startMonitoring() {
    manager.monitorCharacteristicForDevice(deviceID, serviceID, characteristicID, (err, rxSerial) => {
      if (err) {
        console.log(err)
      } else {
        const decodedCommad = base64.decode(rxSerial.value)
        setReceiveCommand(decodedCommad)
      }
    }, 'LISTEN')
  }

  useEffect(() => {
    verifyStatus()
  }, [])

  return (
    <View style={isScanning ? styles.opacityContainer : styles.container}>
      <ScrollView
      showsVerticalScrollIndicator={false}
      >
      <Modal
        visible={isScanning}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size={80}
            color='#20BF55'
            marginBottom={20}
          />
          <TouchableOpacity
            onPress={stopScanDevices}
            style={styles.action}
          >
            <Text style={styles.actionText}>Stop Scan</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.headerText}>Bluetooth</Text>
        <Switch onValueChange={toogleStatus} value={isEnable} />
      </View>

      {!isConnected ? (
        <View>
          <TouchableOpacity
            onPress={startScanDevices}
            disabled={!isEnable}
            style={isEnable ? styles.action : styles.actionDisabled}
          >
            <Text style={styles.actionText}>Scan</Text>
          </TouchableOpacity>



          {isEnable && (
            <View>
              <Text style={styles.title}>Available Devices</Text>
              <FlatList
                data={deviceList}
                keyExtractor={fDevice => String(fDevice.id)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: fDevice }) => (
                  <TouchableOpacity
                    onPress={fDevice.name ? () => connect(fDevice) : notAvailableAlert}
                    style={styles.actionDevice}
                  >
                    <Feather name="bluetooth" size={22} color='#20BF55' />
                    <Text style={styles.deviceText}>{fDevice.name ? fDevice.name : 'Unnamed'}</Text>
                    <Feather name="link" size={22} color='#20BF55' />
                  </TouchableOpacity>
                )}
              />
            </View>)}


        </View>
      ) : (
          <View>
            <TouchableOpacity
              onPress={disconnect}
              style={styles.action}
            >
              <Text style={styles.actionText}>Disconnect</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Available Devices</Text>
            <TouchableOpacity
              onPress={disconnect}
              style={styles.actionDevice}
            >
              <Feather name="bluetooth" size={22} color='#20BF55' />
              <Text style={styles.deviceText}>{connectedDevice.name}</Text>
              <Feather name="x-circle" size={22} color='#20BF55' />
            </TouchableOpacity>
            <View style={styles.detailContainer}>
              
              <Text><Text style={styles.featured}>Device ID : </Text> {deviceID}</Text>
            </View>

            <View style={styles.viewFooter}>

              <View style={styles.viewRow}>
                <View style={styles.txtBorded}>
                  <Text>Receive {receiveCommand}</Text>
                </View>
              </View>
              <View style={styles.viewRow}>
                <TextInput
                  style={styles.txtInput}
                  placeholder='Command'
                  onChangeText={(val) => setSendCommand(val)}
                >
                </TextInput>
                <TouchableOpacity
                  onPress={writeCommand}
                >
                  <Feather name="send" size={30} color='#20BF55' />
                </TouchableOpacity>
              </View>

            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles= StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20
    },

    opacityContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
        opacity: 0.5,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },

    headerText: {
        fontSize: 24,
        color: '#737380',
        fontFamily:'FuturaL'
    },

    return: {
        flexDirection: 'row'
    },

    action: {
        marginTop: 25,
        backgroundColor: '#20BF55',
        borderRadius: 8,
        height: 50,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15
    },

    actionDisabled: {
        marginTop: 25,
        backgroundColor: '#20BF55',
        borderRadius: 8,
        height: 50,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15
    },

    actionText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },

    title: {
        marginTop: 15,
        fontSize: 22,
        marginBottom: 16,
        color: '#0B4F6C',
        fontFamily:'FuturaH'
    },

    actionDevice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10
    },

    deviceText: {
        marginLeft: 10,
        fontSize: 22,
        color: '#737380',
        width: '80%'
    },

    featured: {
        fontWeight: "bold"
    },

    detailContainer: {
        marginVertical: 10,
        padding: 5,
    },

    loadingContainer: {
        flex: 1,
        alignContent: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },

    viewFooter: {
        marginTop: 10
    },

    txtInput: {
        borderWidth: 1,
        borderColor: '#FFA707',
        borderRadius: 8,
        width: '87%'
    },

    viewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 10,
        alignItems: 'center',
    },

    txtBorded: {
        borderColor: '#FFA707',
        borderWidth: 1,
        paddingVertical: 15,
        paddingHorizontal: 5,
        borderRadius: 8,
        width: '87%'
    }
})