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

const Header = ({
    onDatabaseChanged,
    notificationCount = 0,
    notifications = [],
    onMarkAllNotificationsRead,
    onMarkNotificationRead,
    onDeleteNotification,
}) => {
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);
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

    const handleNotificationBellPress = () => {
        setIsNotificationModalVisible(true);
    };

    const closeNotificationModal = () => {
        setIsNotificationModalVisible(false);
    };

    const formatNotificationTime = (timestamp) => {
        if (!timestamp) {
            return '';
        }

        try {
            return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            return '';
        }
    };

    const renderNotificationItem = ({ item }) => (
        <View style={[
            styles.notificationItem,
            !item.isRead && styles.unreadNotificationItem,
        ]}>
            <View style={styles.notificationItemIconWrap}>
                <Icon name={item.isRead ? "bell" : "bell"} size={12} color={item.isRead ? "#333" : "#8a6c09"} />
            </View>
            <View style={styles.notificationItemContent}>
                <Text style={styles.notificationItemTitle}>{item.title}</Text>
                <Text style={styles.notificationItemBody}>{item.body}</Text>
                <Text style={styles.notificationItemTime}>{formatNotificationTime(item.receivedAt)}</Text>
                <View style={styles.notificationActionsRow}>
                    {!item.isRead && (
                        <TouchableOpacity
                            style={styles.notificationActionButton}
                            onPress={() => {
                                if (typeof onMarkNotificationRead === 'function') {
                                    onMarkNotificationRead(item.id);
                                }
                            }}
                        >
                            <Text style={styles.notificationActionText}>Mark read</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.notificationDeleteButton}
                        onPress={() => {
                            if (typeof onDeleteNotification === 'function') {
                                onDeleteNotification(item.id);
                            }
                        }}
                    >
                        <Text style={styles.notificationDeleteText}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
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
                        style={styles.notificationButton}
                        onPress={handleNotificationBellPress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Icon name="bell" size={16} color="#333" />
                        {notificationCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>
                                    {notificationCount > 99 ? '99+' : notificationCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

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
                            color="#333" 
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
                                    </TouchableWithoutFeedback>
                                </View>
                            </TouchableWithoutFeedback>
                        </Modal>
                    )}

                    <Modal
                        transparent
                        visible={isNotificationModalVisible}
                        animationType="fade"
                        onRequestClose={closeNotificationModal}
                    >
                        <TouchableWithoutFeedback onPress={closeNotificationModal}>
                            <View style={styles.notificationBackdrop}>
                                <TouchableWithoutFeedback>
                                    <View style={styles.notificationModalCard}>
                                        <View style={styles.notificationModalHeader}>
                                            <Text style={styles.notificationModalTitle}>Notifications</Text>
                                            <TouchableOpacity onPress={closeNotificationModal}>
                                                <Icon name="times" size={15} color="#666" />
                                            </TouchableOpacity>
                                        </View>

                                        {notifications.length > 0 ? (
                                            <FlatList
                                                data={notifications}
                                                renderItem={renderNotificationItem}
                                                keyExtractor={(item) => item.id}
                                                style={styles.notificationList}
                                            />
                                        ) : (
                                            <View style={styles.emptyNotificationWrap}>
                                                <Icon name="bell-slash" size={24} color="#888" />
                                                <Text style={styles.emptyNotificationText}>No notifications yet</Text>
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            style={styles.markReadButton}
                                            onPress={() => {
                                                if (typeof onMarkAllNotificationsRead === 'function') {
                                                    onMarkAllNotificationsRead();
                                                }
                                            }}
                                        >
                                            <Text style={styles.markReadText}>Mark all as read</Text>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableWithoutFeedback>
                            </View>
                        </TouchableWithoutFeedback>
                    </Modal>
                </View>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        width: '100%',
        alignSelf: 'stretch',
        backgroundColor: 'goldenrod',
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
        backgroundColor: 'goldenrod',
        minHeight: Platform.OS === 'ios' ? 72 : 60,
        overflow: 'visible',
        zIndex: 1000,
        elevation: 1000,
    },
    leftSpacer: {
        width: 170,
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
        width: 170,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'visible',
        zIndex: 1200,
        elevation: 1200,
    },
    rightSpacer: {
        width: 80,
    },
    notificationButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        marginRight: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        position: 'relative',
        marginLeft: Platform.OS === 'ios' ? 6 : 12,
    },
    notificationBadge: {
        position: 'absolute',
        top: -6,
        right: -8,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        backgroundColor: '#ff3b30',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'goldenrod',
    },
    notificationBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 12,
    },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    selectedCountryText: {
        fontSize: 15,
        marginRight: 4,
    },
    countryCode: {
        fontSize: 11,
        fontWeight: '700',
        color: '#333',
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
    notificationBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.15)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 118 : 88,
    },
    notificationModalCard: {
        width: 300,
        maxHeight: 360,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 8,
    },
    notificationModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    notificationModalTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
        letterSpacing: 0.3,
    },
    notificationList: {
        maxHeight: 240,
    },
    notificationItem: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    unreadNotificationItem: {
        backgroundColor: '#fffaf0',
    },
    notificationItemIconWrap: {
        width: 24,
        marginTop: 1,
        alignItems: 'center',
    },
    notificationItemContent: {
        flex: 1,
    },
    notificationItemTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    notificationItemBody: {
        marginTop: 2,
        fontSize: 12,
        color: '#4f5b6b',
    },
    notificationItemTime: {
        marginTop: 4,
        fontSize: 11,
        color: '#8590a1',
    },
    notificationActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    notificationActionButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#f5f5f5',
        marginRight: 8,
    },
    notificationActionText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#333',
    },
    notificationDeleteButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#fdeceb',
    },
    notificationDeleteText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#c62828',
    },
    emptyNotificationWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 28,
    },
    emptyNotificationText: {
        marginTop: 8,
        fontSize: 12,
        color: '#888',
    },
    markReadButton: {
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingVertical: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
    },
    markReadText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#333',
        letterSpacing: 0.2,
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: '#f8f9fa',
    },
    dropdownTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333',
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
        backgroundColor: '#e3f2fd',
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