import React, { useState, useContext, useEffect } from "react";
import { 
    StyleSheet, 
    Image, 
    View, 
    Text, 
    Alert,
    TouchableOpacity,
    TouchableWithoutFeedback,
    FlatList,
    Modal,
    Platform,
    ActionSheetIOS
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

    const countries = [
        { id: 1, label: 'Ethiopia', value: 'Ethio', flag: '🇪🇹', currency: 'ETB' },
        { id: 2, label: 'USA', value: 'USA', flag: '🇺🇸', currency: '$' }
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
                let resolvedDbName = dbName;

                if (token) {
                    try {
                        const response = await axios.post(
                            switchUrl,
                            { database: dbName },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        resolvedDbName = response?.data?.database || dbName;
                    } catch (switchError) {
                        // Fallback to local database selection if server-side switch is restricted.
                        resolvedDbName = dbName;
                    }
                }

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
        if (Platform.OS === "ios") {
            const options = countries.map((country) => `${country.flag} ${country.label} (${country.currency})`);
            const cancelButtonIndex = options.length;

            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [...options, "Cancel"],
                    cancelButtonIndex,
                },
                (buttonIndex) => {
                    if (buttonIndex === cancelButtonIndex) {
                        return;
                    }

                    const selected = countries[buttonIndex];
                    if (selected) {
                        handleCountrySelect(selected);
                    }
                }
            );
            return;
        }

        setIsDropdownVisible((prev) => !prev);
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
                    <TouchableOpacity
                        style={styles.countrySelector}
                        onPress={toggleDropdown}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.selectedCountryText}>
                            {countries.find(c => c.value === selectedCountry)?.flag}
                        </Text>
                        <Text style={styles.countryCode}>{selectedCountry}</Text>
                        <Icon 
                            name={isDropdownVisible ? "chevron-up" : "chevron-down"} 
                            size={10} 
                            color="#ffffff" 
                            style={styles.chevron}
                        />
                    </TouchableOpacity>

                    {Platform.OS !== "ios" && (
                        <Modal
                            transparent
                            visible={isDropdownVisible}
                            animationType="fade"
                            onRequestClose={() => setIsDropdownVisible(false)}
                        >
                            <TouchableWithoutFeedback onPress={() => setIsDropdownVisible(false)}>
                                <View style={styles.dropdownBackdrop}>
                                    <TouchableWithoutFeedback>
                                        <View style={styles.inlineDropdownContainer}>
                                            <View style={styles.dropdownHeader}>
                                                <Text style={styles.dropdownTitle}>Select Country</Text>
                                                <TouchableOpacity
                                                    onPress={() => setIsDropdownVisible(false)}
                                                >
                                                    <Icon name="times" size={16} color="#ffffff" />
                                                </TouchableOpacity>
                                            </View>

                                            <FlatList
                                                data={countries}
                                                renderItem={renderCountryItem}
                                                keyExtractor={(item) => item.id.toString()}
                                                style={styles.dropdownList}
                                            />
                                        </View>
                                    </TouchableWithoutFeedback>
                                </View>
                            </TouchableWithoutFeedback>
                        </Modal>
                    )}
                </View>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        width: '100%',
        alignSelf: 'stretch',
        backgroundColor: '#1a237e',
        paddingTop: Platform.OS === 'ios' ? 10 : 0,
        overflow: 'visible',
        zIndex: 1000,
        elevation: 1000,
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        backgroundColor: '#1a237e',
        minHeight: Platform.OS === 'ios' ? 72 : 60,
        overflow: 'visible',
        zIndex: 1000,
        elevation: 1000,
    },
    leftSpacer: {
        width: 92,
    },
    logoContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        height: 48,
        width: 150,
    },
    rightContainer: {
        width: 92,
        alignItems: 'flex-end',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'visible',
        zIndex: 1200,
        elevation: 1200,
    },
    rightSpacer: {
        width: 80,
    },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    selectedCountryText: {
        fontSize: 15,
        marginRight: 4,
    },
    countryCode: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
        marginRight: 4,
        letterSpacing: 0.4,
    },
    chevron: {
        marginLeft: 2,
    },
    inlineDropdownContainer: {
        width: 260,
        backgroundColor: 'white',
        borderRadius: 16,
        maxHeight: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        overflow: 'hidden',
    },
    dropdownBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.12)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 128 : 98,
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#e8eaf6',
        backgroundColor: '#1a237e',
    },
    dropdownTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.3,
    },
    dropdownList: {
        maxHeight: 240,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        backgroundColor: 'white',
    },
    selectedItem: {
        backgroundColor: '#e8eaf6',
    },
    flagEmoji: {
        fontSize: 26,
        marginRight: 14,
    },
    countryInfo: {
        flex: 1,
    },
    countryLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    currencyLabel: {
        fontSize: 12,
        color: '#757575',
        marginTop: 2,
    },
})

export default Header;