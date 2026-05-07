import React, { useState, useContext, useEffect } from "react";
import { 
    StyleSheet, 
    Image, 
    View, 
    Text, 
    Alert,
    TouchableOpacity,
    Modal,
    FlatList 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthContext } from "../Context/store/Auth";
import Icon from "react-native-vector-icons/FontAwesome5";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "../assets/common/baseUrl";
import { COUNTRY_DB_MAP, getDatabaseNameFromStorage, setDatabaseNameInStorage } from "../assets/common/databaseConfig";

const DB_COUNTRY_MAP = {
    E_Shopping: "Ethio",
    E_ShopUSA: "USA",
};

const Header = ({ onDatabaseChanged }) => {
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('Ethio');
    const context = useContext(AuthContext);

    // Check if user is admin
    const isAdmin = context.user?.isAdmin || context.user?.role === 'admin';

    const countries = [
        { id: 1, label: 'Ethiopia', value: 'Ethio', flag: '🇪🇹', currency: 'ETB' },
        { id: 2, label: 'USA', value: 'USA', flag: '🇺🇸', currency: 'USD' }
    ];

    useEffect(() => {
        const syncCountryFromSavedDb = async () => {
            const savedDb = await getDatabaseNameFromStorage();
            const countryValue = DB_COUNTRY_MAP[savedDb] || 'Ethio';
            setSelectedCountry(countryValue);
        };

        syncCountryFromSavedDb();
    }, []);

    const handleCountrySelect = async (country) => {
        setIsDropdownVisible(false);

        if (country.value === selectedCountry) {
            return;
        }

        const dbName = COUNTRY_DB_MAP[country.value];
        if (dbName) {
            try {
                const token = await AsyncStorage.getItem("token");
                const switchUrl = `${baseUrl}database/switch`;
                console.log("[DB Switch] Calling:", switchUrl, "with database:", dbName);
                const response = await axios.post(switchUrl, {
                    database: dbName,
                }, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const resolvedDbName = response?.data?.database || dbName;
                const resolvedCountry = DB_COUNTRY_MAP[resolvedDbName] || country.value;

                await setDatabaseNameInStorage(resolvedDbName);
                setSelectedCountry(resolvedCountry);

                if (typeof onDatabaseChanged === 'function') {
                    onDatabaseChanged();
                }
            } catch (error) {
                const message =
                    error?.response?.data?.message ||
                    error?.message ||
                    "Could not switch database.";

                Alert.alert("Database Switch Failed", message);
            }
        }
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