import {
  useGetCar,
  useUpdateCar,
  useGetInspection,
  useUpsertInspection,
  useListMaintenance,
  useCreateMaintenance,
  useUpdateMaintenance,
  useDeleteMaintenance,
  useListTodos,
  useCreateTodo,
  useUpdateTodo,
  useDeleteTodo,
  useListMileage,
  useCreateMileage,
  useDeleteMileage,
  useUpdateCosts,
} from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
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

type Tab = "INSPECTION" | "MAINTENANCE" | "NEEDS DONE" | "MILEAGE" | "COSTS";

export default function CarDetailScreen() {
  const { id } = useLocalSearchParams();
  const carId = parseInt(id as string);
  const [activeTab, setActiveTab] = useState<Tab>("INSPECTION");
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: car, isLoading: carLoading, refetch: refetchCar } = useGetCar(carId);

  if (carLoading || !car) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.tint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{car.year} {car.make} {car.model}</Text>
          <Text style={styles.headerSubtitle}>STK: {car.stockNumber}</Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={() => setIsEditModalVisible(true)}>
          <Ionicons name="create-outline" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {(["INSPECTION", "MAINTENANCE", "NEEDS DONE", "MILEAGE", "COSTS"] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.content}>
        {activeTab === "INSPECTION" && <InspectionTab carId={carId} />}
        {activeTab === "MAINTENANCE" && <MaintenanceTab carId={carId} />}
        {activeTab === "NEEDS DONE" && <TodosTab carId={carId} />}
        {activeTab === "MILEAGE" && <MileageTab carId={carId} carMileage={car.mileage || 0} />}
        {activeTab === "COSTS" && <CostsTab car={car} />}
      </View>

      <EditCarModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(true)}
        car={car}
        onSuccess={() => {
          setIsEditModalVisible(false);
          refetchCar();
        }}
      />
    </View>
  );
}

function InspectionTab({ carId }: { carId: number }) {
  const { data: items, isLoading, refetch } = useGetInspection(carId);
  const upsertMutation = useUpsertInspection(carId);
  const queryClient = useQueryClient();

  const groupedItems = useMemo(() => {
    if (!items) return {};
    return items.reduce((acc: any, item: any) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [items]);

  const summary = useMemo(() => {
    if (!items) return { pass: 0, fail: 0, advisory: 0 };
    return items.reduce((acc, item) => {
      if (item.status === "pass") acc.pass++;
      if (item.status === "fail") acc.fail++;
      if (item.status === "advisory") acc.advisory++;
      return acc;
    }, { pass: 0, fail: 0, advisory: 0 });
  }, [items]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedUpsert = useCallback((updatedItems: typeof items) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      upsertMutation.mutate({ data: updatedItems as any });
    }, 1000);
  }, []);

  const updateItemStatus = (itemId: number, status: string) => {
    if (!items) return;
    const newItems = items.map(item => 
      item.id === itemId ? { ...item, status: status as any } : item
    );
    queryClient.setQueryData(["getInspection", carId], newItems);
    debouncedUpsert(newItems.map(i => ({
      id: i.id,
      category: i.category,
      item: i.item,
      status: i.status,
      notes: i.notes
    })));
  };

  const updateItemNotes = (itemId: number, notes: string) => {
    if (!items) return;
    const newItems = items.map(item => 
      item.id === itemId ? { ...item, notes } : item
    );
    queryClient.setQueryData(["getInspection", carId], newItems);
    debouncedUpsert(newItems.map(i => ({
      id: i.id,
      category: i.category,
      item: i.item,
      status: i.status,
      notes: i.notes
    })));
  };

  if (isLoading) return <ActivityIndicator style={{ marginTop: 20 }} color={Colors.dark.tint} />;

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, { backgroundColor: "#065F46" }]}>
          <Text style={styles.summaryValue}>{summary.pass}</Text>
          <Text style={styles.summaryLabel}>PASS</Text>
        </View>
        <View style={[styles.summaryBox, { backgroundColor: "#991B1B" }]}>
          <Text style={styles.summaryValue}>{summary.fail}</Text>
          <Text style={styles.summaryLabel}>FAIL</Text>
        </View>
        <View style={[styles.summaryBox, { backgroundColor: "#92400E" }]}>
          <Text style={styles.summaryValue}>{summary.advisory}</Text>
          <Text style={styles.summaryLabel}>ADVISORY</Text>
        </View>
      </View>

      {Object.entries(groupedItems).map(([category, catItems]: [string, any]) => (
        <View key={category} style={styles.categorySection}>
          <Text style={styles.categoryTitle}>{category}</Text>
          {catItems.map((item: any) => (
            <View key={item.id} style={styles.inspectionItem}>
              <View style={styles.inspectionItemHeader}>
                <Text style={styles.inspectionItemName}>{item.item}</Text>
                <View style={styles.statusSelectors}>
                  {["pass", "fail", "advisory", "na", "pending"].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusDot,
                        styles[`statusDot_${s}` as keyof typeof styles],
                        item.status === s && styles[`statusDot_${s}_selected` as keyof typeof styles]
                      ]}
                      onPress={() => updateItemStatus(item.id, s)}
                    />
                  ))}
                </View>
              </View>
              <TextInput
                style={styles.inspectionNotes}
                placeholder="Add notes..."
                placeholderTextColor={Colors.dark.muted}
                value={item.notes || ""}
                onChangeText={(v) => updateItemNotes(item.id, v)}
                multiline
              />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function MaintenanceTab({ carId }: { carId: number }) {
  const { data: entries, isLoading, refetch } = useListMaintenance(carId);
  const createMutation = useCreateMaintenance();
  const deleteMutation = useDeleteMaintenance();
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleDelete = (entryId: number) => {
    Alert.alert("Delete Entry", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteMutation.mutateAsync({ carId, entryId });
        queryClient.invalidateQueries({ queryKey: ["listMaintenance", carId] });
      }}
    ]);
  };

  if (isLoading) return <ActivityIndicator style={{ marginTop: 20 }} color={Colors.dark.tint} />;

  return (
    <View style={styles.tabContent}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => (
            <TouchableOpacity style={styles.deleteActionTab} onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}>
            <View style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>{new Date(item.date).toLocaleDateString()}</Text>
                <Text style={styles.entryCost}>${Number(item.cost || 0).toFixed(2)}</Text>
              </View>
              <Text style={styles.entryDesc}>{item.description}</Text>
              <Text style={styles.entryTech}>Tech: {item.technician || "N/A"}</Text>
              {item.notes && <Text style={styles.entryNotes}>{item.notes}</Text>}
            </View>
          </Swipeable>
        )}
        ListEmptyComponent={<Text style={styles.emptyTextTab}>No maintenance recorded</Text>}
      />
      <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
        <Ionicons name="add" size={26} color="#000" />
      </TouchableOpacity>
      <AddMaintenanceModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        carId={carId}
        onSuccess={() => {
          setIsModalVisible(false);
          queryClient.invalidateQueries({ queryKey: ["listMaintenance", carId] });
        }}
      />
    </View>
  );
}

function TodosTab({ carId }: { carId: number }) {
  const { data: todos, isLoading } = useListTodos(carId);
  const createMutation = useCreateTodo();
  const updateMutation = useUpdateTodo();
  const deleteMutation = useDeleteTodo();
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const toggleTodo = async (todo: any) => {
    await updateMutation.mutateAsync({
      carId,
      todoId: todo.id,
      data: { ...todo, completed: !todo.completed }
    });
    queryClient.invalidateQueries({ queryKey: ["listTodos", carId] });
  };

  const handleDelete = (todoId: number) => {
    Alert.alert("Delete Item", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteMutation.mutateAsync({ carId, todoId });
        queryClient.invalidateQueries({ queryKey: ["listTodos", carId] });
      }}
    ]);
  };

  const groupedTodos = useMemo(() => {
    if (!todos) return { high: [], medium: [], low: [] };
    return todos.reduce((acc: any, t) => {
      acc[t.priority].push(t);
      return acc;
    }, { high: [], medium: [], low: [] });
  }, [todos]);

  if (isLoading) return <ActivityIndicator style={{ marginTop: 20 }} color={Colors.dark.tint} />;

  return (
    <View style={styles.tabContent}>
      <ScrollView>
        {["high", "medium", "low"].map((p) => (
          groupedTodos[p].length > 0 && (
            <View key={p} style={styles.categorySection}>
              <Text style={[styles.categoryTitle, { color: p === "high" ? Colors.dark.error : p === "medium" ? Colors.dark.warning : Colors.dark.muted }]}>
                {p.toUpperCase()} PRIORITY
              </Text>
              {groupedTodos[p].map((todo: any) => (
                <Swipeable key={todo.id} renderRightActions={() => (
                  <TouchableOpacity style={styles.deleteActionTab} onPress={() => handleDelete(todo.id)}>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                )}>
                  <TouchableOpacity style={styles.todoCard} onPress={() => toggleTodo(todo)}>
                    <Ionicons
                      name={todo.completed ? "checkbox-outline" : "square-outline"}
                      size={24}
                      color={todo.completed ? Colors.dark.success : Colors.dark.muted}
                    />
                    <View style={styles.todoContent}>
                      <Text style={[styles.todoDesc, todo.completed && styles.todoCompleted]}>{todo.description}</Text>
                      {todo.notes && <Text style={styles.todoNotes}>{todo.notes}</Text>}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              ))}
            </View>
          )
        ))}
        {todos?.length === 0 && <Text style={styles.emptyTextTab}>No items needed</Text>}
      </ScrollView>
      <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
        <Ionicons name="add" size={26} color="#000" />
      </TouchableOpacity>
      <AddTodoModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        carId={carId}
        onSuccess={() => {
          setIsModalVisible(false);
          queryClient.invalidateQueries({ queryKey: ["listTodos", carId] });
        }}
      />
    </View>
  );
}

function MileageTab({ carId, carMileage }: { carId: number, carMileage: number }) {
  const { data: entries, isLoading } = useListMileage(carId);
  const createMutation = useCreateMileage();
  const deleteMutation = useDeleteMileage();
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleDelete = (entryId: number) => {
    Alert.alert("Delete Entry", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteMutation.mutateAsync({ carId, entryId });
        queryClient.invalidateQueries({ queryKey: ["listMileage", carId] });
        queryClient.invalidateQueries({ queryKey: ["getCar", carId] });
      }}
    ]);
  };

  if (isLoading) return <ActivityIndicator style={{ marginTop: 20 }} color={Colors.dark.tint} />;

  return (
    <View style={styles.tabContent}>
      <View style={styles.mileageHeader}>
        <Text style={styles.currentMileageLabel}>Current Odometer</Text>
        <Text style={styles.currentMileageValue}>{carMileage.toLocaleString()} mi</Text>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => (
            <TouchableOpacity style={styles.deleteActionTab} onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}>
            <View style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryDate}>{item.odometer.toLocaleString()} mi</Text>
                <Text style={styles.entryTech}>{item.reason}</Text>
              </View>
              <Text style={styles.entryDesc}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              {item.fuelAdded && <Text style={styles.entryNotes}>Fuel Added: {item.fuelAdded} gal</Text>}
              {item.notes && <Text style={styles.entryNotes}>{item.notes}</Text>}
            </View>
          </Swipeable>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
        <Ionicons name="add" size={26} color="#000" />
      </TouchableOpacity>
      <AddMileageModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        carId={carId}
        onSuccess={() => {
          setIsModalVisible(false);
          queryClient.invalidateQueries({ queryKey: ["listMileage", carId] });
          queryClient.invalidateQueries({ queryKey: ["getCar", carId] });
        }}
      />
    </View>
  );
}

function CostsTab({ car }: { car: any }) {
  const [form, setForm] = useState({
    laborRate: car.laborRate || "0",
    repairNotes: car.repairNotes || "",
    partsCost: car.partsCost || "0",
    laborHours: car.laborHours || "0",
    actualRepairNotes: car.actualRepairNotes || "",
    actualPartsCost: car.actualPartsCost || "0",
    actualLaborHours: car.actualLaborHours || "0",
  });
  const updateMutation = useUpdateCosts(car.id);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    await updateMutation.mutateAsync({ data: form });
    queryClient.invalidateQueries({ queryKey: ["getCar", car.id] });
    Alert.alert("Success", "Costs updated");
  };

  const projectedTotal = (Number(form.partsCost) || 0) + (Number(form.laborHours) || 0) * (Number(form.laborRate) || 0);
  const actualTotal = (Number(form.actualPartsCost) || 0) + (Number(form.actualLaborHours) || 0) * (Number(form.laborRate) || 0);
  const variance = projectedTotal - actualTotal;

  return (
    <KeyboardAwareScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.costSection}>
        <Text style={styles.costSectionTitle}>Labor Rate</Text>
        <TextInput
          style={styles.modalInput}
          value={form.laborRate}
          onChangeText={(v) => setForm({ ...form, laborRate: v })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.costSection}>
        <View style={styles.costHeader}>
          <Text style={styles.costSectionTitle}>Projected Estimate</Text>
          <Text style={styles.costTotal}>Total: ${projectedTotal.toFixed(2)}</Text>
        </View>
        <Text style={styles.label}>Repair Notes</Text>
        <TextInput
          style={[styles.modalInput, { height: 80 }]}
          value={form.repairNotes}
          onChangeText={(v) => setForm({ ...form, repairNotes: v })}
          multiline
        />
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Parts Cost</Text>
            <TextInput
              style={styles.modalInput}
              value={form.partsCost}
              onChangeText={(v) => setForm({ ...form, partsCost: v })}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Labor Hours</Text>
            <TextInput
              style={styles.modalInput}
              value={form.laborHours}
              onChangeText={(v) => setForm({ ...form, laborHours: v })}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={styles.costSection}>
        <View style={styles.costHeader}>
          <Text style={styles.costSectionTitle}>Actual Costs</Text>
          <Text style={styles.costTotal}>Total: ${actualTotal.toFixed(2)}</Text>
        </View>
        <Text style={styles.label}>Actual Repair Notes</Text>
        <TextInput
          style={[styles.modalInput, { height: 80 }]}
          value={form.actualRepairNotes}
          onChangeText={(v) => setForm({ ...form, actualRepairNotes: v })}
          multiline
        />
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Actual Parts</Text>
            <TextInput
              style={styles.modalInput}
              value={form.actualPartsCost}
              onChangeText={(v) => setForm({ ...form, actualPartsCost: v })}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Actual Hours</Text>
            <TextInput
              style={styles.modalInput}
              value={form.actualLaborHours}
              onChangeText={(v) => setForm({ ...form, actualLaborHours: v })}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={[styles.varianceBox, { backgroundColor: variance >= 0 ? "#065F46" : "#991B1B" }]}>
        <Text style={styles.varianceLabel}>Budget Variance</Text>
        <Text style={styles.varianceValue}>
          {variance >= 0 ? "UNDER BUDGET" : "OVER BUDGET"}: ${Math.abs(variance).toFixed(2)}
        </Text>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSave} disabled={updateMutation.isPending}>
        {updateMutation.isPending ? <ActivityIndicator color="#000" /> : <Text style={styles.submitButtonText}>SAVE COSTS</Text>}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}

// Helper Modals
function AddMaintenanceModal({ visible, onClose, carId, onSuccess }: any) {
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], description: "", technician: "", cost: "", notes: "" });
  const mutation = useCreateMaintenance();
  const handleSubmit = async () => {
    if (!form.description || !form.date) return;
    await mutation.mutateAsync({ carId, data: { ...form, cost: Number(form.cost) || 0 } });
    onSuccess();
    setForm({ date: new Date().toISOString().split("T")[0], description: "", technician: "", cost: "", notes: "" });
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAwareScrollView style={styles.modalContainer}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Add Maintenance</Text><TouchableOpacity onPress={onClose}><Text style={styles.closeButton}>Cancel</Text></TouchableOpacity></View>
        <View style={styles.form}>
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput style={styles.modalInput} value={form.date} onChangeText={(v) => setForm({...form, date: v})} />
          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.modalInput} value={form.description} onChangeText={(v) => setForm({...form, description: v})} />
          <Text style={styles.label}>Technician</Text>
          <TextInput style={styles.modalInput} value={form.technician} onChangeText={(v) => setForm({...form, technician: v})} />
          <Text style={styles.label}>Cost</Text>
          <TextInput style={styles.modalInput} value={form.cost} onChangeText={(v) => setForm({...form, cost: v})} keyboardType="numeric" />
          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.modalInput, { height: 80 }]} value={form.notes} onChangeText={(v) => setForm({...form, notes: v})} multiline />
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}><Text style={styles.submitButtonText}>ADD ENTRY</Text></TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

function AddTodoModal({ visible, onClose, carId, onSuccess }: any) {
  const [form, setForm] = useState({ description: "", priority: "medium" as const, notes: "", completed: false });
  const mutation = useCreateTodo();
  const handleSubmit = async () => {
    if (!form.description) return;
    await mutation.mutateAsync({ carId, data: form });
    onSuccess();
    setForm({ description: "", priority: "medium", notes: "", completed: false });
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAwareScrollView style={styles.modalContainer}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Add Need</Text><TouchableOpacity onPress={onClose}><Text style={styles.closeButton}>Cancel</Text></TouchableOpacity></View>
        <View style={styles.form}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.modalInput} value={form.description} onChangeText={(v) => setForm({...form, description: v})} />
          <Text style={styles.label}>Priority</Text>
          <View style={styles.statusPicker}>
            {["high", "medium", "low"].map(p => (
              <TouchableOpacity key={p} style={[styles.statusOption, form.priority === p && styles.statusOptionSelected]} onPress={() => setForm({...form, priority: p as any})}>
                <Text style={[styles.statusOptionText, form.priority === p && styles.statusOptionTextSelected]}>{p.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.modalInput, { height: 80 }]} value={form.notes} onChangeText={(v) => setForm({...form, notes: v})} multiline />
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}><Text style={styles.submitButtonText}>ADD ITEM</Text></TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

function AddMileageModal({ visible, onClose, carId, onSuccess }: any) {
  const [form, setForm] = useState({ odometer: "", reason: "Road Test / QC", fuelAdded: "", notes: "" });
  const mutation = useCreateMileage();
  const handleSubmit = async () => {
    if (!form.odometer) return;
    await mutation.mutateAsync({ carId, data: { ...form, odometer: parseInt(form.odometer), fuelAdded: Number(form.fuelAdded) || 0 } });
    onSuccess();
    setForm({ odometer: "", reason: "Road Test / QC", fuelAdded: "", notes: "" });
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAwareScrollView style={styles.modalContainer}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Add Mileage</Text><TouchableOpacity onPress={onClose}><Text style={styles.closeButton}>Cancel</Text></TouchableOpacity></View>
        <View style={styles.form}>
          <Text style={styles.label}>Odometer</Text>
          <TextInput style={styles.modalInput} value={form.odometer} onChangeText={(v) => setForm({...form, odometer: v})} keyboardType="numeric" />
          <Text style={styles.label}>Reason</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 50, marginTop: 8 }}>
            {["Road Test / QC", "Parts Run", "Customer Demo", "Delivery", "Shop Move", "Customer Vehicle", "Other"].map(r => (
              <TouchableOpacity key={r} style={[styles.statusOption, { paddingHorizontal: 16, marginRight: 8, width: "auto" }, form.reason === r && styles.statusOptionSelected]} onPress={() => setForm({...form, reason: r})}>
                <Text style={[styles.statusOptionText, form.reason === r && styles.statusOptionTextSelected]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Fuel Added (Gallons)</Text>
          <TextInput style={styles.modalInput} value={form.fuelAdded} onChangeText={(v) => setForm({...form, fuelAdded: v})} keyboardType="numeric" />
          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.modalInput, { height: 80 }]} value={form.notes} onChangeText={(v) => setForm({...form, notes: v})} multiline />
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}><Text style={styles.submitButtonText}>ADD LOG</Text></TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

function EditCarModal({ visible, onClose, car, onSuccess }: any) {
  const [form, setForm] = useState({ ...car, year: car.year.toString(), mileage: car.mileage?.toString() || "0", sold: car.sold === 1 });
  const mutation = useUpdateCar();
  const handleUpdate = async () => {
    await mutation.mutateAsync({ carId: car.id, data: { ...form, year: parseInt(form.year), mileage: parseInt(form.mileage) || 0, sold: form.sold ? 1 : 0 } });
    onSuccess();
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAwareScrollView style={styles.modalContainer}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Edit Vehicle</Text><TouchableOpacity onPress={onClose}><Text style={styles.closeButton}>Cancel</Text></TouchableOpacity></View>
        <View style={styles.form}>
          <Text style={styles.label}>Stock Number</Text>
          <TextInput style={styles.modalInput} value={form.stockNumber} onChangeText={(v) => setForm({...form, stockNumber: v})} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Year</Text>
              <TextInput style={styles.modalInput} value={form.year} onChangeText={(v) => setForm({...form, year: v})} keyboardType="numeric" />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Make</Text>
              <TextInput style={styles.modalInput} value={form.make} onChangeText={(v) => setForm({...form, make: v})} />
            </View>
          </View>
          <Text style={styles.label}>Model</Text>
          <TextInput style={styles.modalInput} value={form.model} onChangeText={(v) => setForm({...form, model: v})} />
          <Text style={styles.label}>VIN</Text>
          <TextInput style={styles.modalInput} value={form.vin} onChangeText={(v) => setForm({...form, vin: v})} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}><Text style={styles.label}>Color</Text><TextInput style={styles.modalInput} value={form.color} onChangeText={(v) => setForm({...form, color: v})} /></View>
            <View style={{ flex: 1 }}><Text style={styles.label}>Mileage</Text><TextInput style={styles.modalInput} value={form.mileage} onChangeText={(v) => setForm({...form, mileage: v})} keyboardType="numeric" /></View>
          </View>
          <TouchableOpacity style={[styles.statusOption, { marginTop: 20, height: 48, backgroundColor: form.sold ? Colors.dark.error : Colors.dark.card }]} onPress={() => setForm({...form, sold: !form.sold})}>
            <Text style={styles.statusOptionText}>{form.sold ? "MARK AS ACTIVE" : "MARK AS SOLD"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitButton} onPress={handleUpdate}><Text style={styles.submitButtonText}>UPDATE VEHICLE</Text></TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.dark.background, justifyContent: "center", alignItems: "center" },
  header: { padding: 16, backgroundColor: Colors.dark.background, borderBottomWidth: 1, borderBottomColor: Colors.dark.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.dark.text },
  headerSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.dark.muted },
  editButton: { width: 44, height: 44, backgroundColor: Colors.dark.tint, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  tabBar: { height: 50, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  tabBarContent: { paddingHorizontal: 16 },
  tabItem: { paddingHorizontal: 16, justifyContent: "center", height: "100%", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabItemActive: { borderBottomColor: Colors.dark.tint },
  tabText: { color: Colors.dark.muted, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  tabTextActive: { color: Colors.dark.tint },
  content: { flex: 1 },
  tabContent: { flex: 1, padding: 16 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  summaryBox: { flex: 1, padding: 12, borderRadius: 8, alignItems: "center" },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.7)" },
  categorySection: { marginBottom: 24 },
  categoryTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.dark.muted, marginBottom: 12, letterSpacing: 1 },
  inspectionItem: { backgroundColor: Colors.dark.card, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.dark.border },
  inspectionItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  inspectionItemName: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.dark.text },
  statusSelectors: { flexDirection: "row", gap: 6 },
  statusDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "transparent", opacity: 0.3 },
  statusDot_pass: { backgroundColor: Colors.dark.success },
  statusDot_fail: { backgroundColor: Colors.dark.error },
  statusDot_advisory: { backgroundColor: Colors.dark.warning },
  statusDot_na: { backgroundColor: "#4B5563" },
  statusDot_pending: { backgroundColor: "#1F2937" },
  statusDot_pass_selected: { opacity: 1, borderColor: "#fff" },
  statusDot_fail_selected: { opacity: 1, borderColor: "#fff" },
  statusDot_advisory_selected: { opacity: 1, borderColor: "#fff" },
  statusDot_na_selected: { opacity: 1, borderColor: "#fff" },
  statusDot_pending_selected: { opacity: 1, borderColor: "#fff" },
  inspectionNotes: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.text, backgroundColor: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 4 },
  entryCard: { backgroundColor: Colors.dark.card, padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: Colors.dark.tint },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  entryDate: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.dark.text },
  entryCost: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.dark.success },
  entryDesc: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.dark.text, marginBottom: 2 },
  entryTech: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.dark.muted, marginBottom: 4 },
  entryNotes: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.muted, fontStyle: "italic" },
  deleteActionTab: { backgroundColor: Colors.dark.error, justifyContent: "center", alignItems: "center", width: 60, height: "100%", borderRadius: 12, marginLeft: 10 },
  fab: { position: "absolute", right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.dark.tint, justifyContent: "center", alignItems: "center", elevation: 4 },
  todoCard: { backgroundColor: Colors.dark.card, padding: 16, borderRadius: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  todoContent: { flex: 1 },
  todoDesc: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.dark.text },
  todoCompleted: { textDecorationLine: "line-through", color: Colors.dark.muted },
  todoNotes: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.dark.muted, marginTop: 2 },
  mileageHeader: { backgroundColor: Colors.dark.card, padding: 20, borderRadius: 12, marginBottom: 20, alignItems: "center" },
  currentMileageLabel: { fontSize: 14, color: Colors.dark.muted, fontFamily: "Inter_500Medium" },
  currentMileageValue: { fontSize: 32, color: Colors.dark.tint, fontFamily: "Inter_700Bold" },
  costSection: { marginBottom: 24 },
  costHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 },
  costSectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.dark.text },
  costTotal: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.dark.tint },
  varianceBox: { padding: 20, borderRadius: 12, alignItems: "center", marginBottom: 20 },
  varianceLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_600SemiBold" },
  varianceValue: { fontSize: 18, color: "#fff", fontFamily: "Inter_700Bold" },
  emptyTextTab: { textAlign: "center", marginTop: 40, color: Colors.dark.muted, fontFamily: "Inter_400Regular" },
  modalContainer: { flex: 1, backgroundColor: Colors.dark.background },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  modalTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: Colors.dark.text },
  closeButton: { color: Colors.dark.tint, fontFamily: "Inter_500Medium" },
  form: { padding: 20 },
  label: { color: Colors.dark.muted, fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 8, marginTop: 16 },
  modalInput: { backgroundColor: Colors.dark.card, borderRadius: 8, height: 48, paddingHorizontal: 12, color: Colors.dark.text, fontFamily: "Inter_400Regular", borderWidth: 1, borderColor: Colors.dark.border },
  row: { flexDirection: "row" },
  statusPicker: { flexDirection: "row", gap: 8, marginTop: 8 },
  statusOption: { flex: 1, height: 40, backgroundColor: Colors.dark.card, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.dark.border },
  statusOptionSelected: { backgroundColor: Colors.dark.tint, borderColor: Colors.dark.tint },
  statusOptionText: { color: Colors.dark.text, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statusOptionTextSelected: { color: "#000" },
  submitButton: { height: 56, backgroundColor: Colors.dark.tint, borderRadius: 8, justifyContent: "center", alignItems: "center", marginTop: 32 },
  submitButtonText: { color: "#000", fontSize: 16, fontFamily: "Inter_700Bold" },
});
