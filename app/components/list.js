import React from 'react';
import { View, FlatList, StyleSheet, Text } from 'react-native';
import Data from './data';

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});


const List = ({ itemList}) => (
    <View style={styles.container}>
        
        <FlatList
                data={itemList}
                renderItem={({ item }) => <Data
                    name={item.name}
                    album={item.album}
                    artist={item.artist} 
                    
                    
                />}
            />

    </View>
);

export default List;