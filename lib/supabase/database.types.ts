export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          accion: string
          creado_en: string
          detalle: Json | null
          entidad: string
          entidad_id: string | null
          id: number
          usuario: string | null
        }
        Insert: {
          accion: string
          creado_en?: string
          detalle?: Json | null
          entidad: string
          entidad_id?: string | null
          id?: never
          usuario?: string | null
        }
        Update: {
          accion?: string
          creado_en?: string
          detalle?: Json | null
          entidad?: string
          entidad_id?: string | null
          id?: never
          usuario?: string | null
        }
        Relationships: []
      }
      citas: {
        Row: {
          actualizado_en: string
          calendly_event_uri: string
          calendly_invitee_uri: string
          cancelada_en: string | null
          contacto_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["cita_estado"]
          id: string
          inicio: string
          llamada_id: string | null
          motivo_cancelacion: string | null
          reprogramada_desde: string | null
        }
        Insert: {
          actualizado_en?: string
          calendly_event_uri: string
          calendly_invitee_uri: string
          cancelada_en?: string | null
          contacto_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["cita_estado"]
          id?: string
          inicio: string
          llamada_id?: string | null
          motivo_cancelacion?: string | null
          reprogramada_desde?: string | null
        }
        Update: {
          actualizado_en?: string
          calendly_event_uri?: string
          calendly_invitee_uri?: string
          cancelada_en?: string | null
          contacto_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["cita_estado"]
          id?: string
          inicio?: string
          llamada_id?: string | null
          motivo_cancelacion?: string | null
          reprogramada_desde?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "citas_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_llamada_id_fkey"
            columns: ["llamada_id"]
            isOneToOne: false
            referencedRelation: "llamadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_reprogramada_desde_fkey"
            columns: ["reprogramada_desde"]
            isOneToOne: false
            referencedRelation: "citas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          festivos: Json
          franjas: Json
          horas_entre_reintentos: number
          id: number
          max_concurrencia: number
          max_reintentos: number
          pausa_global: boolean
          timeout_llamada_min: number
          tipo_campana: Database["public"]["Enums"]["tipo_campana"]
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          festivos?: Json
          franjas?: Json
          horas_entre_reintentos?: number
          id?: number
          max_concurrencia?: number
          max_reintentos?: number
          pausa_global?: boolean
          timeout_llamada_min?: number
          tipo_campana?: Database["public"]["Enums"]["tipo_campana"]
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          festivos?: Json
          franjas?: Json
          horas_entre_reintentos?: number
          id?: number
          max_concurrencia?: number
          max_reintentos?: number
          pausa_global?: boolean
          timeout_llamada_min?: number
          tipo_campana?: Database["public"]["Enums"]["tipo_campana"]
        }
        Relationships: []
      }
      contactos: {
        Row: {
          actualizado_en: string
          consentimiento: boolean
          consentimiento_fecha: string | null
          consentimiento_origen: string | null
          creado_en: string
          email: string | null
          estado: Database["public"]["Enums"]["contacto_estado"]
          id: string
          intentos: number
          no_llamar_en: string | null
          nombre: string
          notas: string | null
          requiere_seguimiento: boolean
          seguimiento_motivo: string | null
          telefono: string
          ultimo_intento_en: string | null
        }
        Insert: {
          actualizado_en?: string
          consentimiento?: boolean
          consentimiento_fecha?: string | null
          consentimiento_origen?: string | null
          creado_en?: string
          email?: string | null
          estado?: Database["public"]["Enums"]["contacto_estado"]
          id?: string
          intentos?: number
          no_llamar_en?: string | null
          nombre: string
          notas?: string | null
          requiere_seguimiento?: boolean
          seguimiento_motivo?: string | null
          telefono: string
          ultimo_intento_en?: string | null
        }
        Update: {
          actualizado_en?: string
          consentimiento?: boolean
          consentimiento_fecha?: string | null
          consentimiento_origen?: string | null
          creado_en?: string
          email?: string | null
          estado?: Database["public"]["Enums"]["contacto_estado"]
          id?: string
          intentos?: number
          no_llamar_en?: string | null
          nombre?: string
          notas?: string | null
          requiere_seguimiento?: boolean
          seguimiento_motivo?: string | null
          telefono?: string
          ultimo_intento_en?: string | null
        }
        Relationships: []
      }
      eventos_webhook: {
        Row: {
          error: string | null
          id: string
          id_externo: string
          origen: string
          payload: Json | null
          procesado_en: string | null
          recibido_en: string
          tipo: string
        }
        Insert: {
          error?: string | null
          id?: string
          id_externo: string
          origen: string
          payload?: Json | null
          procesado_en?: string | null
          recibido_en?: string
          tipo: string
        }
        Update: {
          error?: string | null
          id?: string
          id_externo?: string
          origen?: string
          payload?: Json | null
          procesado_en?: string | null
          recibido_en?: string
          tipo?: string
        }
        Relationships: []
      }
      llamadas: {
        Row: {
          actualizado_en: string
          analisis: Json | null
          calendly_cancel_url: string | null
          calendly_event_uri: string | null
          calendly_invitee_uri: string | null
          calendly_reschedule_url: string | null
          cita_agendada: boolean
          clasificacion: string | null
          contacto_id: string
          conversation_id: string | null
          creado_en: string
          duracion_seg: number | null
          estado: Database["public"]["Enums"]["llamada_estado"]
          fecha_cita: string | null
          finalizada_en: string | null
          id: string
          lanzada_por: string | null
          lote_id: string | null
          motivo_fallo: string | null
          resultado: string | null
          sip_call_id: string | null
          transcripcion: Json | null
          webhook_recibido_en: string | null
        }
        Insert: {
          actualizado_en?: string
          analisis?: Json | null
          calendly_cancel_url?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          calendly_reschedule_url?: string | null
          cita_agendada?: boolean
          clasificacion?: string | null
          contacto_id: string
          conversation_id?: string | null
          creado_en?: string
          duracion_seg?: number | null
          estado?: Database["public"]["Enums"]["llamada_estado"]
          fecha_cita?: string | null
          finalizada_en?: string | null
          id?: string
          lanzada_por?: string | null
          lote_id?: string | null
          motivo_fallo?: string | null
          resultado?: string | null
          sip_call_id?: string | null
          transcripcion?: Json | null
          webhook_recibido_en?: string | null
        }
        Update: {
          actualizado_en?: string
          analisis?: Json | null
          calendly_cancel_url?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          calendly_reschedule_url?: string | null
          cita_agendada?: boolean
          clasificacion?: string | null
          contacto_id?: string
          conversation_id?: string | null
          creado_en?: string
          duracion_seg?: number | null
          estado?: Database["public"]["Enums"]["llamada_estado"]
          fecha_cita?: string | null
          finalizada_en?: string | null
          id?: string
          lanzada_por?: string | null
          lote_id?: string | null
          motivo_fallo?: string | null
          resultado?: string | null
          sip_call_id?: string | null
          transcripcion?: Json | null
          webhook_recibido_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llamadas_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llamadas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      lote_items: {
        Row: {
          actualizado_en: string
          contacto_id: string
          creado_en: string
          estado: Database["public"]["Enums"]["lote_item_estado"]
          id: string
          intentos: number
          lote_id: string
          motivo_omision: string | null
          proximo_intento_en: string | null
          ultima_llamada_id: string | null
        }
        Insert: {
          actualizado_en?: string
          contacto_id: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["lote_item_estado"]
          id?: string
          intentos?: number
          lote_id: string
          motivo_omision?: string | null
          proximo_intento_en?: string | null
          ultima_llamada_id?: string | null
        }
        Update: {
          actualizado_en?: string
          contacto_id?: string
          creado_en?: string
          estado?: Database["public"]["Enums"]["lote_item_estado"]
          id?: string
          intentos?: number
          lote_id?: string
          motivo_omision?: string | null
          proximo_intento_en?: string | null
          ultima_llamada_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lote_items_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_items_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_items_ultima_llamada_id_fkey"
            columns: ["ultima_llamada_id"]
            isOneToOne: false
            referencedRelation: "llamadas"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["lote_estado"]
          id: string
          nombre: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["lote_estado"]
          id?: string
          nombre?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["lote_estado"]
          id?: string
          nombre?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      borrar_contacto_rgpd: {
        Args: { p_contacto_id: string }
        Returns: undefined
      }
      contactos_por_estado: {
        Args: never
        Returns: {
          estado: Database["public"]["Enums"]["contacto_estado"]
          total: number
        }[]
      }
      crear_llamada: {
        Args: {
          p_contacto_id: string
          p_lanzada_por?: string
          p_lote_id?: string
        }
        Returns: string
      }
      llamadas_activas: { Args: never; Returns: number }
      marcar_no_llamar: {
        Args: { p_contacto_id: string; p_origen?: string }
        Returns: undefined
      }
    }
    Enums: {
      cita_estado: "activa" | "cancelada" | "reprogramada"
      contacto_estado:
        | "pendiente"
        | "llamado"
        | "cita_agendada"
        | "no_interesado"
        | "no_contesta"
        | "no_llamar"
      llamada_estado:
        | "iniciada"
        | "en_curso"
        | "completada"
        | "fallida"
        | "buzon"
      lote_estado: "activo" | "pausado" | "completado" | "cancelado"
      lote_item_estado:
        | "en_cola"
        | "en_llamada"
        | "esperando_reintento"
        | "completado"
        | "omitido"
        | "fallido"
      tipo_campana: "comercial" | "no_comercial"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cita_estado: ["activa", "cancelada", "reprogramada"],
      contacto_estado: [
        "pendiente",
        "llamado",
        "cita_agendada",
        "no_interesado",
        "no_contesta",
        "no_llamar",
      ],
      llamada_estado: [
        "iniciada",
        "en_curso",
        "completada",
        "fallida",
        "buzon",
      ],
      lote_estado: ["activo", "pausado", "completado", "cancelado"],
      lote_item_estado: [
        "en_cola",
        "en_llamada",
        "esperando_reintento",
        "completado",
        "omitido",
        "fallido",
      ],
      tipo_campana: ["comercial", "no_comercial"],
    },
  },
} as const
