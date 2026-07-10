"""Unit tests for the RouterOS output parser (Section 16)."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "shield-backend"))

import pytest
from app.services.routeros_parser import (
    parse_routeros_records,
    parse_routeros_bool,
    parse_routeros_bytes,
    parse_routeros_duration,
    parse_routeros_number,
    parse_routeros_temperature,
    parse_routeros_voltage,
    parse_routeros_percent,
    format_bytes,
    format_bitrate,
)


class TestParseRecords:
    def test_basic_as_value(self):
        raw = '.id=*1 name="ether1" running=yes mtu=1500'
        records = parse_routeros_records(raw)
        assert len(records) == 1
        assert records[0][".id"] == "*1"
        assert records[0]["name"] == "ether1"
        assert records[0]["running"] == "yes"
        assert records[0]["mtu"] == "1500"

    def test_multiple_records(self):
        raw = (
            '.id=*1 name="ether1" running=yes\n'
            '.id=*2 name="ether2" running=no disabled=yes\n'
            '.id=*3 name="bridge" running=yes'
        )
        records = parse_routeros_records(raw)
        assert len(records) == 3
        assert records[0]["name"] == "ether1"
        assert records[1]["name"] == "ether2"
        assert records[2]["name"] == "bridge"

    def test_comment_with_spaces(self):
        raw = '.id=*1 name="ether1" comment="WAN uplink to ISP" running=yes'
        records = parse_routeros_records(raw)
        assert records[0]["comment"] == "WAN uplink to ISP"

    def test_empty_input(self):
        assert parse_routeros_records("") == []
        assert parse_routeros_records("\n\n") == []

    def test_interface_name_with_special_chars(self):
        raw = '.id=*B name="pppoe-out1" running=yes type="pppoe-out"'
        records = parse_routeros_records(raw)
        assert records[0]["name"] == "pppoe-out1"
        assert records[0]["type"] == "pppoe-out"

    def test_dynamic_interface(self):
        raw = '.id=*D name="<pppoe-user>" running=yes dynamic=yes'
        records = parse_routeros_records(raw)
        assert records[0]["dynamic"] == "yes"


class TestParseBool:
    def test_yes_no(self):
        assert parse_routeros_bool("yes") is True
        assert parse_routeros_bool("no") is False

    def test_true_false(self):
        assert parse_routeros_bool("true") is True
        assert parse_routeros_bool("false") is False

    def test_none(self):
        assert parse_routeros_bool(None) is None
        assert parse_routeros_bool("") is None
        assert parse_routeros_bool("unknown") is None


class TestParseBytes:
    def test_kib(self):
        assert parse_routeros_bytes("1024KiB") == 1048576
        assert parse_routeros_bytes("64.0MiB") == 67108864

    def test_raw_integer(self):
        assert parse_routeros_bytes("123456") == 123456

    def test_none(self):
        assert parse_routeros_bytes(None) is None
        assert parse_routeros_bytes("") is None


class TestParseDuration:
    def test_hours_minutes(self):
        assert parse_routeros_duration("17h15m3s") == 62103.0

    def test_weeks_days(self):
        seconds = parse_routeros_duration("2w3d")
        assert seconds == (2 * 604800 + 3 * 86400)

    def test_milliseconds(self):
        assert parse_routeros_duration("500ms") == 0.5

    def test_none(self):
        assert parse_routeros_duration(None) is None
        assert parse_routeros_duration("") is None


class TestParseNumber:
    def test_simple_int(self):
        assert parse_routeros_number("12345") == 12345

    def test_with_spaces(self):
        assert parse_routeros_number("27 933 576") == 27933576

    def test_float(self):
        assert parse_routeros_number("15.5") == 15.5

    def test_none(self):
        assert parse_routeros_number(None) is None


class TestParseTemperature:
    def test_with_c(self):
        assert parse_routeros_temperature("43C") == 43.0

    def test_without_c(self):
        assert parse_routeros_temperature("38") == 38.0

    def test_none(self):
        assert parse_routeros_temperature(None) is None


class TestParseVoltage:
    def test_with_v(self):
        assert parse_routeros_voltage("24.2V") == 24.2

    def test_none(self):
        assert parse_routeros_voltage(None) is None


class TestParsePercent:
    def test_with_percent(self):
        assert parse_routeros_percent("15%") == 15.0

    def test_without_percent(self):
        assert parse_routeros_percent("85") == 85.0

    def test_none(self):
        assert parse_routeros_percent(None) is None


class TestFormatBytes:
    def test_bytes(self):
        assert format_bytes(500) == "500 B"

    def test_kib(self):
        assert "KiB" in format_bytes(2048)

    def test_gib(self):
        assert "GiB" in format_bytes(4294967296)

    def test_zero(self):
        assert format_bytes(0) == "0 B"

    def test_none(self):
        assert format_bytes(None) == "N/A"


class TestFormatBitrate:
    def test_bps(self):
        assert format_bitrate(500) == "500 bps"

    def test_mbps(self):
        assert "Mbps" in format_bitrate(5000000)

    def test_none(self):
        assert format_bitrate(None) == "0 bps"
