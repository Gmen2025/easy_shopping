import React from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '@react-navigation/native';
import EasyButton from '../Shared/StyledComponenets/EasyButton';

const { width, height } = Dimensions.get('window');

const MaintenanceScreen = ({ navigation: navProp, isAdmin = false }) => {
  const navigationHook = useNavigation();
  const navigation = navProp || navigationHook;

  const handleLogout = () => {
    navigation.navigate('Maintenance');
  };

  const handleAdminPanel = () => {
    navigation.navigate('Admin');
  };

  const handleAdminLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="wrench" size={80} color="#8a6c09" />
        </View>

        <Text style={styles.title}>Maintenance Mode</Text>

        <Text style={styles.subtitle}>
          We're currently performing scheduled maintenance to improve your experience.
        </Text>

        <View style={styles.infoBox}>
          <Icon name="info-circle" size={20} color="#1d72d6" />
          <Text style={styles.infoText}>
            Our team is working hard to bring back the application shortly. We appreciate your patience!
          </Text>
        </View>

        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <Icon name="check-circle" size={16} color="#2E7D32" />
            <Text style={styles.featureText}>Database updates</Text>
          </View>
          <View style={styles.featureItem}>
            <Icon name="check-circle" size={16} color="#2E7D32" />
            <Text style={styles.featureText}>Performance improvements</Text>
          </View>
          <View style={styles.featureItem}>
            <Icon name="check-circle" size={16} color="#2E7D32" />
            <Text style={styles.featureText}>New features coming soon</Text>
          </View>
        </View>

        <View style={styles.contactBox}>
          <Text style={styles.contactTitle}>Need assistance?</Text>
          <Text style={styles.contactText}>
            Please contact our support team for urgent matters.
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        {isAdmin && (
          <EasyButton
            tertiary
            large
            onPress={handleAdminPanel}
            style={styles.adminButton}
          >
            <Text style={styles.adminButtonText}>Admin Panel</Text>
          </EasyButton>
        )}

        {!isAdmin && (
          <EasyButton
            tertiary
            large
            onPress={handleAdminLogin}
            style={styles.adminButton}
          >
            <Text style={styles.adminButtonText}>Admin Login</Text>
          </EasyButton>
        )}

        <EasyButton secondary large onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>
            {isAdmin ? 'Back to Home' : 'Logout'}
          </Text>
        </EasyButton>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f3f6fb',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 30,
    backgroundColor: '#eef5ff',
    borderRadius: 80,
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#152642',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eef5ff',
    borderLeftWidth: 4,
    borderLeftColor: '#1d72d6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    lineHeight: 20,
  },
  featureList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#dce3ef',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    fontWeight: '500',
  },
  contactBox: {
    backgroundColor: '#f0f7f0',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
    width: '100%',
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  adminButton: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  adminButtonText: {
    color: '#0d0d0d',
    fontWeight: '700',
    fontSize: 15,
  },
  logoutButton: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default MaintenanceScreen;
