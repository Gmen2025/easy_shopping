import React, { useState, useContext } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Toast from 'react-native-toast-message';
import EasyButton from '../../Shared/StyledComponenets/EasyButton';
import { useMaintenance } from '../../Context/store/MaintenanceContext';
import { AuthContext } from '../../Context/store/Auth';

const MaintenanceSettings = (props) => {
  const { maintenanceEnabled, toggleMaintenance } = useMaintenance();
  const [isEnabled, setIsEnabled] = useState(maintenanceEnabled);
  const [isLoading, setIsLoading] = useState(false);
  const context = useContext(AuthContext);

  const handleToggleMaintenance = async (value) => {
    setIsLoading(true);
    try {
      const result = await toggleMaintenance(value);

      if (result.success) {
        setIsEnabled(value);
        Toast.show({
          topOffset: 60,
          type: 'success',
          text1: 'Maintenance Mode Updated',
          text2: result.message,
        });
      } else {
        setIsEnabled(!value);
        Toast.show({
          topOffset: 60,
          type: 'error',
          text1: 'Update Failed',
          text2: result.message,
        });
      }
    } catch (error) {
      setIsEnabled(!value);
      Toast.show({
        topOffset: 60,
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update maintenance mode',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmToggle = (value) => {
    const action = value ? 'enable' : 'disable';
    const message = value
      ? 'Are you sure you want to put the application in maintenance mode?\n\nUsers will not be able to access the app.'
      : 'Are you sure you want to disable maintenance mode?\n\nThe application will be available to all users.';

    Alert.alert('Confirm', message, [
      {
        text: 'Cancel',
        onPress: () => {
          setIsEnabled(!value);
        },
        style: 'cancel',
      },
      {
        text: 'Confirm',
        onPress: () => handleToggleMaintenance(value),
        style: value ? 'destructive' : 'default',
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Maintenance Settings</Text>
        <Text style={styles.headerSubtitle}>
          Control application maintenance mode
        </Text>
      </View>

      <Card style={styles.mainCard}>
        <Card.Content>
          <View style={styles.maintenanceSection}>
            <View style={styles.maintenanceTitleContainer}>
              <Icon name="wrench" size={28} color="#8a6c09" />
              <View style={styles.maintenanceTitle}>
                <Text style={styles.sectionTitle}>Maintenance Mode</Text>
                <Text style={styles.sectionSubtitle}>
                  {isEnabled
                    ? 'Application is currently in maintenance'
                    : 'Application is operational'}
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.toggleContainer}>
              <View style={styles.toggleLabel}>
                <Text style={styles.toggleText}>
                  {isEnabled ? 'Maintenance Enabled' : 'Maintenance Disabled'}
                </Text>
                <Text style={styles.toggleDescription}>
                  {isEnabled
                    ? 'Only admins can access the app'
                    : 'All users can access the app'}
                </Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={handleConfirmToggle}
                disabled={isLoading}
                trackColor={{ false: '#d1d5db', true: '#fecaca' }}
                thumbColor={isEnabled ? '#dc2626' : '#6b7280'}
                style={styles.switch}
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>⚠️ What happens during maintenance?</Text>
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Icon name="ban" size={16} color="#dc2626" />
                <Text style={styles.infoText}>
                  Non-admin users cannot access the application
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="shield-alt" size={16} color="#2E7D32" />
                <Text style={styles.infoText}>
                  Admins retain full access to manage and monitor
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="clock" size={16} color="#1d72d6" />
                <Text style={styles.infoText}>
                  A maintenance screen is displayed to users
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Icon name="bell" size={16} color="#8a6c09" />
                <Text style={styles.infoText}>
                  Users can retry accessing the app regularly
                </Text>
              </View>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statusSection}>
            <Text style={styles.statusTitle}>Current Status</Text>
            <View
              style={[
                styles.statusCard,
                isEnabled ? styles.statusCardActive : styles.statusCardInactive,
              ]}
            >
              <Icon
                name={isEnabled ? 'exclamation-circle' : 'check-circle'}
                size={24}
                color={isEnabled ? '#dc2626' : '#2E7D32'}
              />
              <View style={styles.statusText}>
                <Text
                  style={[
                    styles.statusLabel,
                    isEnabled ? styles.statusLabelActive : styles.statusLabelInactive,
                  ]}
                >
                  {isEnabled ? 'MAINTENANCE MODE' : 'OPERATIONAL'}
                </Text>
                <Text style={styles.statusDescription}>
                  {isEnabled
                    ? 'Application is in maintenance. Admin access only.'
                    : 'Application is operational. All users can access.'}
                </Text>
              </View>
            </View>
          </View>

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#8a6c09" />
              <Text style={styles.loadingText}>Updating maintenance mode...</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <View style={styles.spacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#8a6c09',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 18,
  },
  mainCard: {
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dce3ef',
  },
  maintenanceSection: {
    paddingVertical: 16,
  },
  maintenanceTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  maintenanceTitle: {
    marginLeft: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#152642',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6a7380',
  },
  divider: {
    marginVertical: 16,
    backgroundColor: '#e5e7eb',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleLabel: {
    flex: 1,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#152642',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#6a7380',
  },
  switch: {
    marginLeft: 12,
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
  infoSection: {
    paddingVertical: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 12,
  },
  infoList: {
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  statusSection: {
    paddingVertical: 8,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#152642',
    marginBottom: 12,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  statusCardActive: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statusCardInactive: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  statusText: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusLabelActive: {
    color: '#dc2626',
  },
  statusLabelInactive: {
    color: '#2E7D32',
  },
  statusDescription: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#374151',
    marginTop: 12,
  },
  spacing: {
    height: 20,
  },
});

export default MaintenanceSettings;
