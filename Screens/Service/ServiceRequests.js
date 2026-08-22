import React, { useCallback, useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';

import { AuthContext } from '../../Context/store/Auth';
import baseUrl from '../../assets/common/baseUrl';

const STATUS_OPTIONS = [
  { label: 'New', value: 'new' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Quoted', value: 'quoted' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const statusLabel = (value) => {
  const match = STATUS_OPTIONS.find((option) => option.value === value);
  return match ? match.label : String(value || 'New');
};

const ServiceRequests = ({ navigation, route }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const isAdminMode = route?.params?.mode === 'admin';

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setRequests([]);
        return;
      }

      const endpoint = isAdminMode ? `${baseUrl}service-requests` : `${baseUrl}service-requests/mine`;
      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.warn('Load service requests failed:', error?.response?.data || error?.message || error);
      setRequests([]);
      Alert.alert('Could not load requests', error?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isAdminMode]);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const updateStatus = async (requestId, nextStatus) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${baseUrl}service-requests/${requestId}`,
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRequests((prev) =>
        prev.map((request) =>
          request._id === requestId ? { ...request, status: nextStatus } : request
        )
      );
    } catch (error) {
      Alert.alert('Status update failed', error?.response?.data?.message || 'Please try again.');
    }
  };

  const updateManagement = async (requestId, values) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.put(`${baseUrl}service-requests/${requestId}`, values, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests((prev) => prev.map((request) => request._id === requestId ? response.data : request));
    } catch (error) {
      Alert.alert('Service update failed', error?.response?.data?.message || 'Please try again.');
    }
  };

  const acceptQuote = (item) => {
    Alert.alert('Accept quote?', `Confirm ${item.currency || ''} ${item.quotedPrice}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => updateManagement(item._id, { quoteAccepted: true }) },
    ]);
  };

  const renderItem = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.machineName}>{item.machineType || 'Machine Service'}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{statusLabel(item.status)}</Text>
          </View>
        </View>

        <Text style={styles.metaText}>Country: {item.country || '—'}</Text>
        <Text style={styles.metaText}>Location: {item.serviceLocation || '—'}</Text>
        <Text style={styles.metaText}>Priority: {item.priority || 'Normal'}</Text>
        <Text style={styles.metaText}>Problem: {item.problemDescription || '—'}</Text>
        {item.quotedPrice !== null && item.quotedPrice !== undefined ? (
          <Text style={styles.quoteText}>
            Quote: {item.currency || ''} {item.quotedPrice} {item.quoteAccepted ? '(Accepted)' : ''}
          </Text>
        ) : null}

        {isAdminMode ? (
          <View>
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Update status</Text>
              <Picker selectedValue={item.status || 'new'} onValueChange={(value) => updateStatus(item._id, value)} style={styles.picker}>
                {STATUS_OPTIONS.map((option) => <Picker.Item key={option.value} label={option.label} value={option.value} />)}
              </Picker>
            </View>
            <TextInput
              style={styles.managementInput}
              placeholder="Technician user ID (optional)"
              defaultValue={item.assignedTechnician?._id || item.assignedTechnician || ''}
              onEndEditing={(event) => updateManagement(item._id, { assignedTechnician: event.nativeEvent.text.trim() || null })}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.managementInput}
              placeholder="Quote amount"
              defaultValue={item.quotedPrice === null || item.quotedPrice === undefined ? '' : String(item.quotedPrice)}
              keyboardType="decimal-pad"
              onEndEditing={(event) => {
                const value = Number(event.nativeEvent.text);
                if (Number.isFinite(value) && value >= 0) updateManagement(item._id, { quotedPrice: value, status: 'quoted' });
              }}
            />
            <TextInput
              style={styles.managementInput}
              placeholder="Technician notes (optional)"
              defaultValue={item.technicianNotes || ''}
              onEndEditing={(event) => updateManagement(item._id, { technicianNotes: event.nativeEvent.text })}
            />
          </View>
        ) : item.quotedPrice !== null && item.quotedPrice !== undefined && !item.quoteAccepted ? (
          <TouchableOpacity style={styles.acceptButton} onPress={() => acceptQuote(item)}>
            <Text style={styles.acceptButtonText}>Accept Quote</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerRowTop}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isAdminMode ? 'Service Requests' : 'My Service Requests'}</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8a6c09" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No service requests yet.</Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  headerRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#efe7c5',
  },
  backText: {
    color: '#8a6c09',
    fontWeight: '600',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1d1d',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6b7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ece6d3',
    padding: 14,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  machineName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginRight: 10,
  },
  badge: {
    backgroundColor: '#f3e7b5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#5b4200',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaText: {
    color: '#374151',
    fontSize: 13,
    marginTop: 4,
  },
  quoteText: {
    color: '#14532d',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  pickerWrap: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5d7a8',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#faf6e8',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5b4200',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  picker: {
    height: 48,
    color: '#1f2937',
  },
  managementInput: {
    borderWidth: 1,
    borderColor: '#e5d7a8',
    borderRadius: 8,
    backgroundColor: '#fffdf5',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 8,
    color: '#1f2937',
  },
  acceptButton: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#166534',
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default ServiceRequests;
