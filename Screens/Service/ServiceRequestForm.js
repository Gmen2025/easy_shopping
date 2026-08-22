import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Toast from 'react-native-toast-message';

import { AuthContext } from '../../Context/store/Auth';
import Input from '../../Shared/Form/Input';
import EasyButton from '../../Shared/StyledComponenets/EasyButton';
import baseUrl from '../../assets/common/baseUrl';

const COUNTRY_OPTIONS = ['Ethiopia', 'USA'];
const PRIORITY_OPTIONS = ['Low', 'Normal', 'High', 'Emergency'];

const ServiceRequestForm = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    country: 'Ethiopia',
    serviceLocation: 'Addis Ababa',
    machineType: 'Packaging machine',
    manufacturer: 'Siemens',
    model: 'S7-1200',
    controller: 'PLC',
    errorCode: 'Communication fault',
    problemDescription: 'Machine stopped and has a communication fault between the PLC and HMI.',
    priority: 'Emergency',
    locationCity: 'Addis Ababa',
    locationAddress: 'Bole, Addis Ababa',
    budgetEstimate: '',
  });

  useEffect(() => {
    if (!user?._id && !user?.id) {
      Alert.alert('Login required', 'Please sign in before submitting a service request.');
      navigation?.goBack?.();
    }
  }, [user, navigation]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const submitRequest = async () => {
    if (!user?._id && !user?.id) {
      Alert.alert('Login required', 'Please sign in first.');
      return;
    }

    if (!formData.serviceLocation.trim() || !formData.machineType.trim() || !formData.problemDescription.trim()) {
      Alert.alert('Missing details', 'Service location, machine type, and problem description are required.');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');

      const payload = {
        customer: user?._id || user?.id,
        country: formData.country,
        serviceLocation: formData.serviceLocation,
        machineType: formData.machineType,
        manufacturer: formData.manufacturer,
        model: formData.model,
        controller: formData.controller,
        errorCode: formData.errorCode,
        problemDescription: formData.problemDescription,
        priority: formData.priority,
        locationCity: formData.locationCity,
        locationAddress: formData.locationAddress,
        budgetEstimate: formData.budgetEstimate ? Number(formData.budgetEstimate) : null,
        status: 'new',
      };

      const response = await axios.post(`${baseUrl}service-requests`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      Toast.show({
        type: 'success',
        text1: 'Service Request Sent',
        text2: 'Our team will review it and contact you soon.',
      });

      navigation?.goBack?.();
      console.log('Service request created', response.data);
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to submit your request right now.';
      Alert.alert('Request failed', message);
      console.warn('Service request error:', error?.response?.data || error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Machine Repair Request</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionLabel}>Service region</Text>
        <View style={styles.optionWrap}>
          {COUNTRY_OPTIONS.map((country) => (
            <TouchableOpacity
              key={country}
              onPress={() => updateField('country', country)}
              style={[styles.optionChip, formData.country === country && styles.optionChipSelected]}
            >
              <Text style={[styles.optionText, formData.country === country && styles.optionTextSelected]}>{country}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input placeholder="Service location" value={formData.serviceLocation} onChangeText={(value) => updateField('serviceLocation', value)} />
        <Input placeholder="Machine type" value={formData.machineType} onChangeText={(value) => updateField('machineType', value)} />
        <Input placeholder="Manufacturer" value={formData.manufacturer} onChangeText={(value) => updateField('manufacturer', value)} />
        <Input placeholder="Model" value={formData.model} onChangeText={(value) => updateField('model', value)} />
        <Input placeholder="Controller / PLC / HMI / VFD" value={formData.controller} onChangeText={(value) => updateField('controller', value)} />
        <Input placeholder="Error code / fault" value={formData.errorCode} onChangeText={(value) => updateField('errorCode', value)} />

        <Text style={styles.sectionLabel}>Priority</Text>
        <View style={styles.optionWrap}>
          {PRIORITY_OPTIONS.map((priority) => (
            <TouchableOpacity
              key={priority}
              onPress={() => updateField('priority', priority)}
              style={[styles.optionChip, formData.priority === priority && styles.optionChipSelected]}
            >
              <Text style={[styles.optionText, formData.priority === priority && styles.optionTextSelected]}>{priority}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input placeholder="City" value={formData.locationCity} onChangeText={(value) => updateField('locationCity', value)} />
        <Input placeholder="Full site address" value={formData.locationAddress} onChangeText={(value) => updateField('locationAddress', value)} />
        <Input placeholder="Estimated budget" value={formData.budgetEstimate} keyboardType="numeric" onChangeText={(value) => updateField('budgetEstimate', value)} />
        <Input placeholder="Problem description" value={formData.problemDescription} onChangeText={(value) => updateField('problemDescription', value)} />

        <EasyButton
          onPress={submitRequest}
          large
          style={styles.submitButton}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Service Request</Text>}
        </EasyButton>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  headerRow: {
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
  container: {
    padding: 18,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1d1d1d',
    marginTop: 12,
    marginBottom: 8,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  optionChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5d7a8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  optionChipSelected: {
    backgroundColor: '#8a6c09',
    borderColor: '#8a6c09',
  },
  optionText: {
    color: '#4f4f4f',
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#fff',
  },
  submitButton: {
    marginTop: 18,
    backgroundColor: '#8a6c09',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default ServiceRequestForm;
