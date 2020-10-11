import React from 'react';
import {
  Platform,
  StyleSheet,
  Image,
  Text,
  TextInput,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  ActivityIndicator
} from "react-native";
import RNBluetoothClassic, {
  BTEvents,
  BTCharsets,
} from 'react-native-bluetooth-classic';
import {
  Root,
  Container,
  Toast,
  Header,
  Title,
  Button,
  Right,
  Left,
  Icon,
  Body,
  StyleProvider,
} from 'native-base';
import { Buffer } from 'buffer';
import getTheme from './native-base-theme/components';
import material from './native-base-theme/variables/material';
import platform from './native-base-theme/variables/platform';
global.Buffer = global.Buffer
const DeviceList = ({devices, onPress, style}) => {
  console.log('DeviceList.render()');
  console.log(devices);

  return (
    <ScrollView
      style={styles.listContainer}
      contentContainerStyle={styles.container}>
      {devices.map((device, i) => {
        let bgColor = device.connected
          ? '#0f0'
          : styles.connectionStatus.backgroundColor;
        return (
          <TouchableOpacity
            key={device.id}
            style={[styles.button, style]}
            onPress={() => onPress(device)}>
           
            <View style={{flex: 1, elevation:3, borderRadius:5, backgroundColor:'#FFF', padding:'2.5%'}}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text>{device.address}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

class ConnectionScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      text: undefined,
      scannedData: [],
    };
  }

  componentDidMount() {
    this.onRead = RNBluetoothClassic.addListener(
      BTEvents.READ,
      this.handleRead,
      this,
    );
    console.log(this.props.device.name);
    this._sendDeviceInfo(this.props.device.name);
    this.poll = setInterval(() => this.pollForData(), 10000);
  }

  componentWillUnmount() {
    this.onRead.remove();
    //clearInterval(this.poll);

    RNBluetoothClassic.disconnect();
  }

  pollForData = async () => {
    var available = 0;

    do {
      console.log('Checking for available data');
      available = await RNBluetoothClassic.available();
      console.log(`There are ${available} bytes of data available`);

      if (available > 0) {
        console.log('Attempting to read the next message from the device');
        const data = await RNBluetoothClassic.readFromDevice();

        console.log(data);
        this.handleRead({data});
      }
    } while (available > 0);
  };

  _sendDeviceInfo(btd){
    console.log("Sending Device Info")
    fetch('https://86b70a65ef0d.ngrok.io/data',{  
      method: 'POST',   
       body: JSON.stringify({
      device: btd,
    })
  })
  .then(response => response.json())
  .then(data => console.log(data));
  }

    

  handleRead = data => {
    data.timestamp = new Date();
    let scannedData = this.state.scannedData;
    scannedData.unshift(data);
    this.setState({scannedData});
    fetch('https://86b70a65ef0d.ngrok.io/data',{  
      method: 'POST',   
       body: JSON.stringify({
      data: scannedData,
    })
  })
  .then(response => response.json())
  .then(data => console.log(data));
  
  };

  // sendData = async () => {
  //   let message = this.state.text + '\r'; // For commands
  //   await RNBluetoothClassic.write(message);

  //   let scannedData = this.state.scannedData;
  //   scannedData.unshift({
  //     timestamp: new Date(),
  //     data: this.state.text,
  //     type: 'sent',
  //   });
  //   this.setState({text: '', scannedData});
  // };

  render() {
    console.log('DeviceConnection.render()');
    console.log(this.state);

    return (
      <Container>
        <Header style={{backgroundColor:"#20BF55"}}>
          <Left>
            <Title>{this.props.device.name}</Title>
          </Left>
          <Right>
            <TouchableOpacity onPress={this.props.disconnect}>
              <Text style={[styles.toolbarButton, {color: '#FFF'}]}>Disconnect</Text>
            </TouchableOpacity>
          </Right>
        </Header>
        <View style={{flex: 1}}>
       
          <FlatList
            style={{flex: 1}}
            contentContainerStyle={{justifyContent: 'flex-end'}}
            inverted
            ref="scannedDataList"
            data={this.state.scannedData}
            keyExtractor={(item, index) => item.timestamp.toISOString()}
            renderItem={({item}) => (
              <View
                id={item.timestamp.toISOString()}
                style={{flexDirection: 'row', justifyContent: 'flex-start'}}>
                <Text>{item.timestamp.toLocaleDateString()}</Text>
                <Text>{item.type === 'sent' ? ' < ' : ' > '}</Text>
                <Text style={{flexShrink: 1}}>{item.data.trim()}</Text>
              </View>
            )}
          />
          {/* <View style={[styles.horizontalContainer, {backgroundColor: '#ccc'}]}>
            <TextInput
              style={styles.textInput}
              placeholder={'Send Data'}
              value={this.state.text}
              onChangeText={text => this.setState({text})}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={() => this.sendData()}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={{justifyContent: 'center'}}
              onPress={() => this.sendData()}>
              <Text>Send</Text>
            </TouchableOpacity>
          </View> */}
           <Image style={{width:'50%', resizeMode:'contain', height:'50%', alignSelf:'center', marginBottom:'5%'}} source={require('../BluetoothClassicExample/device.png')}></Image>
        </View>
      </Container>
    );
  }
}

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      deviceList: [],
      connectedDevice: undefined,
      scannedData: [],
      isAccepting: false,
      isDiscovering: false
    };
  }

  componentDidMount() {
    this.initialize();
    this.subs = [];

    // Re-initialize whenever a Bluetooth event occurs
    this.subs.push(
      RNBluetoothClassic.addListener(
        BTEvents.BLUETOOTH_CONNECTED,
        device => this.onConnected(device),
        this,
      ),
    );
    this.subs.push(
      RNBluetoothClassic.addListener(
        BTEvents.BLUETOOTH_DISCONNECTED,
        device => this.onDisconnected(device),
        this,
      ),
    );
    this.subs.push(
      RNBluetoothClassic.addListener(
        BTEvents.CONNECTION_LOST,
        error => this.onConnectionLost(error),
        this,
      ),
    );
    this.subs.push(
      RNBluetoothClassic.addListener(
        BTEvents.ERROR,
        error => this.onError(error),
        this,
      ),
    );
  }

  componentWillUnmount() {
    this.subs.forEach(sub => sub.remove());
  }

  onConnected(device) {
    this._sendDeviceInfo(device.name);
    Toast.show({
      text: `Connected to ${device.name}`,
      duration: 3000,
    });
    this.initialize();
  }

  onDisconnected(device) {
    Toast.show({
      text: `Connection to ${device.name} was disconnected`,
      duration: 3000,
    });
    this.initialize();
  }

  onConnectionLost(error) {
    Toast.show({
      text: `Connection to ${error.device.name} was lost`,
      duration: 3000,
    });
    this.initialize();
  }

  onError(error) {
    Toast.show({
      text: `${error.message}`,
      duration: 3000,
    });
    this.initialize();
  }

  async initialize() {
    let enabled = await RNBluetoothClassic.isEnabled();
    this.setState({ bluetoothEnabled: enabled });

    if (enabled) {
      this.refreshDevices();
    }    
  }

  async refreshDevices() {
    let newState = {
      devices: [],
      connectedDevice: undefined,
    };
   
    try {
      let connectedDevice = await RNBluetoothClassic.getConnectedDevice();

      console.log('initializeDevices::connectedDevice');
      console.log(connectedDevice);
      newState.connectedDevice = connectedDevice;
    } catch (error) {
      try {
        let devices = await RNBluetoothClassic.list();

        console.log('initializeDevices::list');
        console.log(devices);
        newState.deviceList = devices;
      } catch (error) {
        console.error(error.message);
      }
    }

    this.setState(newState);
  }

  async connectToDevice(device) {
    console.log(`Attempting connection to device ${device.id}`);
    try {
      await RNBluetoothClassic.setEncoding(BTCharsets.ASCII);
      let connectedDevice = await RNBluetoothClassic.connect(device.id);
      this.setState({connectedDevice});
    } catch (error) {
      console.log(error.message);
      Toast.show({
        text: `Connection to ${device.name} unsuccessful`,
        duration: 3000,
      });
    }
  }

  async disconnectFromDevice() {
    await RNBluetoothClassic.disconnect();
    this.setState({connectedDevice: undefined});
  }

  async acceptConnections() {
    console.log("App is accepting connections now...");
    this.setState({ isAccepting: true });

    try {
      let connectedDevice = await RNBluetoothClassic.accept();

      if (connectedDevice) {
        this.setState({ connectedDevice, isAccepting: false });
      }      
    } catch(error) {
      console.log(error);
      Toast.show({
        text: `Unable to accept client connection`,
        duration: 3000,
      });
      this.setState({ isAccepting: false });
    }
  }

  async cancelAcceptConnections() {
    console.log("Attempting to cancel...");
    
    try {
      await RNBluetoothClassic.cancelAccept();
      this.setState({ isAccepting: false });
    } catch(error) {
      console.log(error);
      Toast.show({
        text: `Unable to cancel accept client connection`,
        duration: 3000,
      });
    }
  }

  async discoverDevices() {
    console.log("Attempting to discover devices...");
    this.setState({ isDiscovering: true });

    try {
      const unpaired = await RNBluetoothClassic.discoverDevices();
      console.log("Unpaired Devices");
      console.log(unpaired);
      Toast.show({
        text: `Found ${unpaired.length} unpaired devices.`,
        duration: 3000
      })
    } catch(error) {
      console.log(error);
      Toast.show({
        text: `Error occurred while attempting to discover devices`,
        duration: 3000
      });
    } finally {
      this.setState({ isDiscovering: false });
    }
  }

  async cancelDiscoverDevices() {
    console.log(`Attempting to cancel discovery...`);

    try {
      await RNBluetoothClassic.cancelDiscovery();
      this.setState({ isDiscovering: false });
    } catch(error) {
      console.log(error);
      Toast.show({
        text: `Error occurred while attempting to cancel discover devices`,
        duration: 3000
      });
    }
  }

  refresh = () => this.refreshDevices();
  selectDevice = device => this.connectToDevice(device);
  unselectDevice = () => this.disconnectFromDevice();
  accept = () => this.acceptConnections();
  cancelAccept = () => this.cancelAcceptConnections();
  discover = () => this.discoverDevices();
  cancelDiscover = () => this.cancelDiscoverDevices();

  render() {
    console.log('App.render()');
    console.log(this.state);

    let connectedColor = !this.state.bluetoothEnabled
      ? styles.toolbarButton.color
      : 'green';

    let acceptFn = !this.state.isAccepting 
      ? () => this.accept()
      : () => this.cancelAccept();      

    let discoverFn = !this.state.isDiscovering
      ? () => this.discover()
      : () => this.cancelDiscover();

    return (
      <StyleProvider style={getTheme(platform)}>
        <Root>
          {this.state.connectedDevice ? (
            <ConnectionScreen
              device={this.state.connectedDevice}
              scannedData={this.state.scannedData}
              disconnect={this.unselectDevice}
              onSend={this.onSend}
            />
          ) : (
            <Container>
             
                 
                
              <DeviceList
                devices={this.state.deviceList}
                onPress={this.selectDevice}
              />
              <Image style={{width:'40%', resizeMode:'contain', height:'30%', alignSelf:'center', marginBottom:'5%'}} source={require('../BluetoothClassicExample/device.png')}></Image>
                  <TouchableOpacity
                    onPress={this.refresh}>
                   <Text style={{fontSize:20, backgroundColor:'#20BF55', color:'#FFF', alignSelf:'center', textAlign:'center', width:'100%', paddingTop:'5%', paddingBottom:'5%'}}>Refresh</Text>
                  </TouchableOpacity>                  
            </Container>
          )}
        </Root>
      </StyleProvider>
    );
  }
}


const APPBAR_HEIGHT = Platform.OS === 'ios' ? 44 : 56;

const styles = StyleSheet.create({
  statusbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
    height: APPBAR_HEIGHT,
  },
  toolbarText: {
    flex: 1,
    fontSize: 20,
    color: '#fff',
  },
  toolbarButton: {
    fontSize: 20,
    color: '#20BF55',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
  },
  startAcceptButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
    padding: 9,
    marginBottom: 9
  },  
  deviceName: {
    fontSize: 16,
  },
  connectionStatus: {
    width: 8,
    backgroundColor: '#ccc',
    marginRight: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  horizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  textInput: {
    flex: 1,
    height: 40,
  },
});
