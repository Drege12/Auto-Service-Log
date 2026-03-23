import {
  useListCars,
  useCreateCar,
  useDeleteCar,
} from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Colors from "@/constants/colors";

export default function CarsListScreen() {
  const [search, setSearch] = useState("");
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: cars, isLoading, refetch, isRefetching } = useListCars();
  const createCarMutation = useCreateCar();
  const deleteCarMutation = useDeleteCar();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const auth = await AsyncStorage.getItem("dt_auth");
    if (!auth) {
      router.replace("/login");
    } else {
      setIsReady(true);
    }
  };

  const filteredCars = useMemo(() => {
    if (!cars) return [];
    return cars.filter((car) => {
      const searchLower = search.toLowerCase();
      return (
        car.stockNumber.toLowerCase().includes(searchLower) ||
        car.make.toLowerCase().includes(searchLower) ||
        car.model.toLowerCase().includes(searchLower) ||
        (car.vin && car.vin.toLowerCase().includes(searchLower))
      );
    });
  }, [cars, search]);

  const handleDelete = (carId: number, stockNumber: string) => {
    Alert.alert(
      "Delete Vehicle",
      `Are you sure you want to delete vehicle ${stockNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteCarMutation.mutateAsync({ carId });
            queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
          },
        },
      ]
    );
  };

  const renderCarItem = ({ item: car }: { item: any }) => {
    const renderRightActions = () => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDelete(car.id, car.stockNumber)}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
      </TouchableOpacity>
    );

    return (
      <Swipeable renderRightActions={renderRightActions}>
        <TouchableOpacity
          style={[styles.carCard, car.sold === 1 && styles.soldCard]}
          onPress={() => router.push(`/car/${car.id}`)}
        >
          <View style={styles.carHeader}>
            <View>
              <Text style={styles.carTitle}>
                {car.year} {car.make} {car.model}
              </Text>
              <Text style={styles.carSubtitle}>Stock #: {car.stockNumber}</Text>
            </View>
            {car.status && (
            <View style={[
              styles.badge, 
              car.status === "in_service" ? styles.badge_in_service : 
              car.status === "ready" ? styles.badge_ready : 
              styles.badge_on_hold
            ]}>
              <Text style={styles.badgeText}>{car.status.replace("_", " ").toUpperCase()}</Text>
            </View>
          )}
          </View>
          <View style={styles.carFooter}>
            <View style={styles.infoItem}>
              <Ionicons name="speedometer-outline" size={14} color={Colors.dark.muted} />
              <Text style={styles.infoText}>{car.mileage?.toLocaleString()} mi</Text>
            </View>
            {car.vin && (
              <View style={styles.infoItem}>
                <Ionicons name="pricetag-outline" size={14} color={Colors.dark.muted} />
                <Text style={styles.infoText}>{car.vin.slice(-6)}</Text>
              </View>
            )}
          </View>
          {car.sold === 1 && (
            <View style={styles.soldOverlay}>
              <Text style={styles.soldText}>SOLD</Text>
            </View>
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (!isReady || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.tint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={Colors.dark.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Stock, Make, Model, VIN..."
            placeholderTextColor={Colors.dark.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setIsAddModalVisible(true)}>
          <Ionicons name="add" size={26} color="#000" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredCars}
        renderItem={renderCarItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.dark.tint}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="build-outline" size={64} color={Colors.dark.muted} />
            <Text style={styles.emptyText}>No vehicles found</Text>
          </View>
        }
      />

      <AddCarModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onSuccess={() => {
          setIsAddModalVisible(false);
          queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
        }}
      />
    </View>
  );
}

function AddCarModal({ visible, onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    stockNumber: "",
    year: "",
    make: "",
    model: "",
    vin: "",
    color: "",
    mileage: "",
    status: "in_service",
  });
  const createCarMutation = useCreateCar();
  const insets = useSafeAreaInsets();

  const handleCreate = async () => {
    if (!form.stockNumber || !form.year || !form.make || !form.model) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }

    try {
      await createCarMutation.mutateAsync({
        data: {
          ...form,
          year: parseInt(form.year),
          mileage: parseInt(form.mileage) || 0,
          status: form.status as any,
        },
      });
      onSuccess();
      setForm({
        stockNumber: "",
        year: "",
        make: "",
        model: "",
        vin: "",
        color: "",
        mileage: "",
        status: "in_service",
      });
    } catch (e) {
      Alert.alert("Error", "Failed to create vehicle.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAwareScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add New Vehicle</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Stock Number *</Text>
          <TextInput
            style={styles.modalInput}
            value={form.stockNumber}
            onChangeText={(v) => setForm({ ...form, stockNumber: v })}
            placeholder="STK-123"
            placeholderTextColor={Colors.dark.muted}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Year *</Text>
              <TextInput
                style={styles.modalInput}
                value={form.year}
                onChangeText={(v) => setForm({ ...form, year: v.replace(/[^0-9]/g, "") })}
                keyboardType="number-pad"
                placeholder="2024"
                placeholderTextColor={Colors.dark.muted}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Make *</Text>
              <TextInput
                style={styles.modalInput}
                value={form.make}
                onChangeText={(v) => setForm({ ...form, make: v })}
                placeholder="Toyota"
                placeholderTextColor={Colors.dark.muted}
              />
            </View>
          </View>

          <Text style={styles.label}>Model *</Text>
          <TextInput
            style={styles.modalInput}
            value={form.model}
            onChangeText={(v) => setForm({ ...form, model: v })}
            placeholder="Camry"
            placeholderTextColor={Colors.dark.muted}
          />

          <Text style={styles.label}>VIN</Text>
          <TextInput
            style={styles.modalInput}
            value={form.vin}
            onChangeText={(v) => setForm({ ...form, vin: v })}
            placeholder="17-digit VIN"
            placeholderTextColor={Colors.dark.muted}
            autoCapitalize="characters"
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.modalInput}
                value={form.color}
                onChangeText={(v) => setForm({ ...form, color: v })}
                placeholder="Silver"
                placeholderTextColor={Colors.dark.muted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Mileage</Text>
              <TextInput
                style={styles.modalInput}
                value={form.mileage}
                onChangeText={(v) => setForm({ ...form, mileage: v.replace(/[^0-9]/g, "") })}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Colors.dark.muted}
              />
            </View>
          </View>

          <Text style={styles.label}>Status</Text>
          <View style={styles.statusPicker}>
            {["in_service", "ready", "on_hold"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusOption, form.status === s && styles.statusOptionSelected]}
                onPress={() => setForm({ ...form, status: s })}
              >
                <Text style={[styles.statusOptionText, form.status === s && styles.statusOptionTextSelected]}>
                  {s.replace("_", " ").toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleCreate} disabled={createCarMutation.isPending}>
            {createCarMutation.isPending ? <ActivityIndicator color="#000" /> : <Text style={styles.submitButtonText}>CREATE VEHICLE</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: Colors.dark.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.dark.tint,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  carCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  soldCard: {
    opacity: 0.6,
  },
  carHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  carTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
    marginBottom: 4,
  },
  carSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.muted,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badge_in_service: { backgroundColor: "#3B82F6" },
  badge_ready: { backgroundColor: "#10B981" },
  badge_on_hold: { backgroundColor: "#F59E0B" },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  carFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.muted,
  },
  deleteAction: {
    backgroundColor: Colors.dark.error,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "85%",
    borderRadius: 12,
    marginLeft: 12,
  },
  soldOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  soldText: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    transform: [{ rotate: "-15deg" }],
    opacity: 0.8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyText: {
    color: Colors.dark.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 18,
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  closeButton: {
    color: Colors.dark.tint,
    fontFamily: "Inter_500Medium",
  },
  form: {
    padding: 20,
  },
  label: {
    color: Colors.dark.muted,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
    marginTop: 16,
  },
  modalInput: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 12,
    color: Colors.dark.text,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  row: {
    flexDirection: "row",
  },
  statusPicker: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  statusOption: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statusOptionSelected: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  statusOptionText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  statusOptionTextSelected: {
    color: "#000",
  },
  submitButton: {
    height: 56,
    backgroundColor: Colors.dark.tint,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  submitButtonText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
