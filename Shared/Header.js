import React, { useState, useContext } from "react";
import { 
    StyleSheet, 
    Image, 
    SafeAreaView, 
    View, 
    Text, 
    TouchableOpacity,
    Modal,
    FlatList 
} from "react-native";
import { AuthContext } from "../Context/store/Auth";
import Icon from "react-native-vector-icons/FontAwesome5";

const Header = () => {
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('Ethio');
    const context = useContext(AuthContext);

    // Check if user is admin
    const isAdmin = context.user?.isAdmin || context.user?.role === 'admin';

    const countries = [
        { id: 1, label: 'Ethiopia', value: 'Ethio', flag: '🇪🇹', currency: 'ETB' },
        { id: 2, label: 'USA', value: 'USA', flag: '🇺🇸', currency: 'USD' }
    ];

    const handleCountrySelect = (country) => {
        setSelectedCountry(country.value);
        setIsDropdownVisible(false);
        
         // Here you can add logic to handle country change
        // For example, update currency, language, etc.
        console.log('Country changed to:', country);
        
        // You might want to save this to AsyncStorage or global state
        // AsyncStorage.setItem('selectedCountry', country.value);
    };

    const toggleDropdown = () => {
        setIsDropdownVisible(!isDropdownVisible);
    };

    const renderCountryItem = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.dropdownItem,
                selectedCountry === item.value && styles.selectedItem
            ]}
            onPress={() => handleCountrySelect(item)}
        >
            <Text style={styles.flagEmoji}>{item.flag}</Text>
            <View style={styles.countryInfo}>
                <Text style={styles.countryLabel}>{item.label}</Text>
                <Text style={styles.currencyLabel}>{item.currency}</Text>
            </View>
            {selectedCountry === item.value && (
                <Icon name="check" size={16} color="#007AFF" />
            )}
        </TouchableOpacity>
    );

    return(
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                {/* Left spacer for centering logo when no admin controls */}
                <View style={styles.leftSpacer}>
                    {/* Empty view for spacing */}
                </View>

                {/* Centered Logo */}
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../assets/addugenet1.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>
                
                {/* Right side - Admin Controls or Spacer */}
                <View style={styles.rightContainer}>
                    {isAdmin ? (
                        <TouchableOpacity
                            style={styles.countrySelector}
                            onPress={toggleDropdown}
                        >
                            <Text style={styles.selectedCountryText}>
                                {countries.find(c => c.value === selectedCountry)?.flag}
                            </Text>
                            <Text style={styles.countryCode}>{selectedCountry}</Text>
                            <Icon 
                                name={isDropdownVisible ? "chevron-up" : "chevron-down"} 
                                size={10} 
                                color="#333" 
                                style={styles.chevron}
                            />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.rightSpacer} />
                    )}
                </View>

                {/* Dropdown Modal */}
                {isAdmin && (
                    <Modal
                        visible={isDropdownVisible}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setIsDropdownVisible(false)}
                    >
                        <TouchableOpacity
                            style={styles.modalOverlay}
                            activeOpacity={1}
                            onPress={() => setIsDropdownVisible(false)}
                        >
                            <View style={styles.dropdownContainer}>
                                <View style={styles.dropdownHeader}>
                                    <Text style={styles.dropdownTitle}>Select Country</Text>
                                    <TouchableOpacity
                                        onPress={() => setIsDropdownVisible(false)}
                                    >
                                        <Icon name="times" size={16} color="#666" />
                                    </TouchableOpacity>
                                </View>
                                
                                <FlatList
                                    data={countries}
                                    renderItem={renderCountryItem}
                                    keyExtractor={(item) => item.id.toString()}
                                    style={styles.dropdownList}
                                />
                            </View>
                        </TouchableOpacity>
                    </Modal>
                )}
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        alignSelf: 'stretch',
        backgroundColor: 'goldenrod', // Ensure SafeAreaView has same background
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        backgroundColor: 'goldenrod',
        minHeight: 50, // Ensure minimum height
        // platform: { android: {
        //     paddingTop: 10,
        // },
    },
    leftSpacer: {
        width: 80, // Same width as right container
    },
    logoContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        height: 50,
        width: 150, // Set explicit width
        margin: -30,
    },
    rightContainer: {
        width: 80,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    rightSpacer: {
        width: 80,
    },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    selectedCountryText: {
        fontSize: 16,
        marginRight: 4,
    },
    countryCode: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
        marginRight: 6,
    },
    chevron: {
        marginLeft: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        minWidth: 250,
        maxHeight: 300,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        marginHorizontal: 20,
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: '#f8f9fa',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    dropdownTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    dropdownList: {
        maxHeight: 200,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        backgroundColor: 'white',
    },
    selectedItem: {
        backgroundColor: '#e3f2fd',
    },
    flagEmoji: {
        fontSize: 24,
        marginRight: 12,
    },
    countryInfo: {
        flex: 1,
    },
    countryLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    currencyLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
})

export default Header;