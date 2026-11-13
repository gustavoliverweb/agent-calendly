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
      admins_plataforma: {
        Row: {
          creado_en: string
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          usuario_id: string
        }
        Update: {
          creado_en?: string
          usuario_id?: string
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          accion: string
          creado_en: string
          detalle: Json | null
          empresa_id: string | null
          entidad: string
          entidad_id: string | null
          id: number
          usuario: string | null
        }
        Insert: {
          accion: string
          creado_en?: string
          detalle?: Json | null
          empresa_id?: string | null
          entidad: string
          entidad_id?: string | null
          id?: never
          usuario?: string | null
        }
        Update: {
          accion?: string
          creado_en?: string
          detalle?: Json | null
          empresa_id?: string | null
          entidad?: string
          entidad_id?: string | null
          id?: never
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      citas: {
        Row: {
          actualizado_en: string
          calendly_event_uri: string
          calendly_invitee_uri: string
          cancelada_en: string | null
          contacto_id: string
          creado_en: string
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
          estado?: Database["public"]["Enums"]["cita_estado"]
          id?: string
          inicio?: string
          llamada_id?: string | null
          motivo_cancelacion?: string | null
          reprogramada_desde?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "citas_contacto_empresa_fkey"
            columns: ["empresa_id", "contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "citas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_llamada_empresa_fkey"
            columns: ["empresa_id", "llamada_id"]
            isOneToOne: false
            referencedRelation: "llamadas"
            referencedColumns: ["empresa_id", "id"]
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
          empresa_id: string
          festivos: Json
          franjas: Json
          horas_entre_reintentos: number
          max_concurrencia: number
          max_reintentos: number
          pausa_global: boolean
          retencion_transcripciones_dias: number
          retencion_webhooks_dias: number
          timeout_llamada_min: number
          tipo_campana: Database["public"]["Enums"]["tipo_campana"]
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          empresa_id: string
          festivos?: Json
          franjas?: Json
          horas_entre_reintentos?: number
          max_concurrencia?: number
          max_reintentos?: number
          pausa_global?: boolean
          retencion_transcripciones_dias?: number
          retencion_webhooks_dias?: number
          timeout_llamada_min?: number
          tipo_campana?: Database["public"]["Enums"]["tipo_campana"]
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          empresa_id?: string
          festivos?: Json
          franjas?: Json
          horas_entre_reintentos?: number
          max_concurrencia?: number
          max_reintentos?: number
          pausa_global?: boolean
          retencion_transcripciones_dias?: number
          retencion_webhooks_dias?: number
          timeout_llamada_min?: number
          tipo_campana?: Database["public"]["Enums"]["tipo_campana"]
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos: {
        Row: {
          actualizado_en: string
          consentimiento: boolean
          consentimiento_fecha: string | null
          consentimiento_origen: string | null
          creado_en: string
          email: string | null
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
        Relationships: [
          {
            foreignKeyName: "contactos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          actualizado_en: string
          creado_en: string
          estado: string
          id: string
          nombre: string
          slug: string
          zona_horaria: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          estado?: string
          id?: string
          nombre: string
          slug: string
          zona_horaria?: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          estado?: string
          id?: string
          nombre?: string
          slug?: string
          zona_horaria?: string
        }
        Relationships: []
      }
      eventos_webhook: {
        Row: {
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
          error?: string | null
          id?: string
          id_externo?: string
          origen?: string
          payload?: Json | null
          procesado_en?: string | null
          recibido_en?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_webhook_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      latidos: {
        Row: {
          en: string
          nombre: string
        }
        Insert: {
          en?: string
          nombre: string
        }
        Update: {
          en?: string
          nombre?: string
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "llamadas_contacto_empresa_fkey"
            columns: ["empresa_id", "contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "llamadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llamadas_lote_empresa_fkey"
            columns: ["empresa_id", "lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      lote_items: {
        Row: {
          actualizado_en: string
          contacto_id: string
          creado_en: string
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "lote_items_contacto_empresa_fkey"
            columns: ["empresa_id", "contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "lote_items_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_items_llamada_empresa_fkey"
            columns: ["empresa_id", "ultima_llamada_id"]
            isOneToOne: false
            referencedRelation: "llamadas"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "lote_items_lote_empresa_fkey"
            columns: ["empresa_id", "lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      lotes: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string | null
          empresa_id: string
          estado: Database["public"]["Enums"]["lote_estado"]
          id: string
          nombre: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          empresa_id: string
          estado?: Database["public"]["Enums"]["lote_estado"]
          id?: string
          nombre?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          empresa_id?: string
          estado?: Database["public"]["Enums"]["lote_estado"]
          id?: string
          nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros: {
        Row: {
          creado_en: string
          empresa_id: string
          rol: Database["public"]["Enums"]["miembro_rol"]
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          empresa_id: string
          rol?: Database["public"]["Enums"]["miembro_rol"]
          usuario_id: string
        }
        Update: {
          creado_en?: string
          empresa_id?: string
          rol?: Database["public"]["Enums"]["miembro_rol"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
      cerrar_lotes_terminados: { Args: never; Returns: number }
      comprobar_acceso_empresa: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      contactos_por_estado: {
        Args: { p_empresa_id: string }
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
      crear_lote: {
        Args: {
          p_contacto_ids: string[]
          p_creado_por?: string
          p_empresa_id: string
          p_nombre?: string
        }
        Returns: string
      }
      equipo_empresa: {
        Args: { p_empresa_id: string }
        Returns: {
          creado_en: string
          email: string
          pendiente: boolean
          rol: Database["public"]["Enums"]["miembro_rol"]
          ultimo_acceso: string
          usuario_id: string
        }[]
      }
      es_miembro: { Args: { p_empresa_id: string }; Returns: boolean }
      kpis_llamadas: {
        Args: { p_desde: string; p_empresa_id: string }
        Returns: {
          citas: number
          contestadas: number
          llamadas: number
          segundos: number
        }[]
      }
      llamadas_activas: { Args: { p_empresa_id: string }; Returns: number }
      marcar_no_llamar: {
        Args: { p_contacto_id: string; p_origen?: string }
        Returns: undefined
      }
      purgar_datos_antiguos: { Args: never; Returns: Json }
      resumen_empresas: {
        Args: never
        Returns: {
          contactos: number
          creado_en: string
          estado: string
          id: string
          llamadas_30d: number
          miembros: number
          nombre: string
          segundos_30d: number
          slug: string
        }[]
      }
      reservar_llamadas_lote: {
        Args: { p_empresa_id: string }
        Returns: {
          contacto_id: string
          email: string
          item_id: string
          llamada_id: string
          lote_id: string
          nombre: string
          telefono: string
        }[]
      }
      usuario_por_email: { Args: { p_email: string }; Returns: string }
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
      miembro_rol: "propietario" | "operador"
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
      miembro_rol: ["propietario", "operador"],
      tipo_campana: ["comercial", "no_comercial"],
    },
  },
} as const
